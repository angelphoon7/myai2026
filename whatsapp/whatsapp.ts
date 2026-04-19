import 'dotenv/config';
import express, { Request, Response } from "express";
import { getAIResponse } from "./ai";
import { getTriageResponse } from "./triage";
import { db } from "./firebase";
import { getUser, handleOnboarding } from "./onboarding";
import { buildOpeningMessage, buildFeedback, buildSummary, scheduleCheckins, initCheckinState, CHECKIN_TOTAL } from "./checkin";
import { getWeeklyPatterns, buildMemoryObservation, buildEscalationAlert, shouldEscalate } from "./memory";

const app = express();
app.use(express.urlencoded({ extended: false }));

function extractUrgency(text: string): "Low" | "Medium" | "Emergency" | "Unknown" {
  if (text.includes("Urgency: Emergency")) return "Emergency";
  if (text.includes("Urgency: Medium")) return "Medium";
  if (text.includes("Urgency: Low")) return "Low";
  return "Unknown";
}

function escapeXml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isYes(msg: string) { return /^(yes|y|1)$/i.test(msg.trim()); }
function isNo(msg: string)  { return /^(no|n|2)$/i.test(msg.trim()); }

function sendTwiml(res: Response, text: string) {
  res.set("Content-Type", "text/xml");
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(text)}</Message>
</Response>`);
}

app.post("/webhook", async (req: Request, res: Response) => {
  try {
    const incomingMsg = req.body.Body || "";
    const from = req.body.From || "";
    console.log("Incoming:", incomingMsg, "From:", from);

    const user = await getUser(from);

    // Onboarding for new users
    if (!user || !user.onboarded) {
      const reply = await handleOnboarding(from, incomingMsg);
      return sendTwiml(res, reply);
    }

    const caregiver = user.caregiverName ?? "there";
    const patient = user.patientName ?? "your patient";

    // Handle escalation choice 1/2/3
    if (user.awaitingEscalationChoice) {
      const choice = incomingMsg.trim();
      await db.collection("users").doc(from).update({ awaitingEscalationChoice: false });
      const responses: Record<string, string> = {
        "1": `✅ Got it, ${caregiver}. I'll remind you about ${patient}'s medication at the next check-in time.`,
        "2": `📲 Noted. Please share this summary with a family member so they can support you.`,
        "3": `🏥 Teleconsult recommended. Please contact your doctor or use your preferred telehealth service to book an appointment for ${patient}.`,
      };
      return sendTwiml(res, responses[choice] ?? `Please reply 1, 2, or 3 to choose an option.`);
    }

    // Handle concern detail → triage assessment
    if (user.awaitingConcernDetail) {
      await db.collection("users").doc(from).update({ awaitingConcernDetail: false, checkinActive: false });
      const patterns = await getWeeklyPatterns(from);
      const triageReply = await getTriageResponse(incomingMsg, {
        caregiverName: caregiver,
        patientName: patient,
        patientAge: user.patientAge,
        condition: user.mainCondition,
        medications: user.medications,
        missedMedDays: patterns.missedMedication,
        skippedMealDays: patterns.skippedMeals,
      });
      await db.collection("messages").add({
        incomingMsg, aiReply: triageReply, urgency: "Unknown", systemAction: "Triage assessment", from,
        createdAt: new Date().toISOString(),
      });
      return sendTwiml(res, triageReply);
    }

    // Handle active check-in yes/no flow
    if (user.checkinActive && (isYes(incomingMsg) || isNo(incomingMsg))) {
      const step = user.checkinStep ?? 0;
      const answer = isYes(incomingMsg) ? "YES" : "NO";
      const questionKey = ["medication", "meals", "concerns"][step];

      const today = new Date().toISOString().split("T")[0];
      await db.collection("checkins").doc(`${from}_${today}`)
        .set({ [questionKey]: answer, phone: from, date: today }, { merge: true });

      const isLast = step + 1 >= CHECKIN_TOTAL;
      const result = buildFeedback(step, isYes(incomingMsg), caregiver, patient);

      if (result.triggerAI) {
        await db.collection("users").doc(from).update({ awaitingConcernDetail: true });
        return sendTwiml(res, result.message);
      } else if (result.showSummary) {
        const today = new Date().toISOString().split("T")[0];
        const checkinDoc = await db.collection("checkins").doc(`${from}_${today}`).get();
        const data = (checkinDoc.data() ?? {}) as Record<string, string>;
        const summary = buildSummary(caregiver, patient, data);
        const patterns = await getWeeklyPatterns(from);
        const escalation = shouldEscalate(patterns) ? buildEscalationAlert(patient, patterns) : "";
        await db.collection("users").doc(from).update({
          checkinActive: false,
          awaitingEscalationChoice: shouldEscalate(patterns),
        });
        return sendTwiml(res, `${summary}${escalation}`);
      } else if (isLast) {
        await db.collection("users").doc(from).update({ checkinActive: false });
      } else {
        await db.collection("users").doc(from).update({ checkinStep: step + 1 });
      }

      return sendTwiml(res, result.message);
    }

    // Update medication list
    if (incomingMsg.trim().toLowerCase().startsWith("/updatemeds ")) {
      const meds = incomingMsg.trim().slice(12).trim();
      await db.collection("users").doc(from).update({ medications: meds });
      return sendTwiml(res, `💊 Medication list updated for ${patient}:\n${meds}\n\nI'll use this in all future assessments.`);
    }

    // Trigger check-in manually
    if (incomingMsg.trim().toLowerCase() === "/checkin") {
      await initCheckinState(from);
      const patterns = await getWeeklyPatterns(from);
      const observation = buildMemoryObservation(patient, patterns);
      const opening = buildOpeningMessage(caregiver, patient);
      const fullMessage = observation ? `${observation}\n\n${opening}` : opening;
      return sendTwiml(res, fullMessage);
    }

    // Normal AI response
    const aiReply = await getAIResponse(incomingMsg, { caregiverName: caregiver, patientName: patient, condition: user.mainCondition, medications: user.medications });
    console.log("AI reply:", aiReply);

    const urgency = extractUrgency(aiReply);
    let systemAction = "No action";
    if (urgency === "Low") systemAction = "Monitoring started";
    else if (urgency === "Medium") systemAction = "Teleconsult should be booked";
    else if (urgency === "Emergency") systemAction = "Emergency services should be alerted immediately";

    console.log("Detected urgency:", urgency, "| System action:", systemAction);

    await db.collection("messages").add({
      incomingMsg, aiReply, urgency, systemAction, from,
      createdAt: new Date().toISOString(),
    });

    return sendTwiml(res, `${aiReply}\nSystem Action: ${systemAction}`);

  } catch (error) {
    console.error("Webhook error:", error);
    return sendTwiml(res, "Sorry, KAI hit an error. Please try again.");
  }
});

app.get("/", (_req: Request, res: Response) => {
  res.send("KAI bot is running");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  scheduleCheckins();
});
