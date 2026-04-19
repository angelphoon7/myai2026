import 'dotenv/config';
import express, { Request, Response } from "express";
import { getAIResponse } from "./ai";
import { getTriageResponse } from "./triage";
import { db } from "./firebase";
import { getUser, handleOnboarding } from "./onboarding";
import { buildOpeningMessage, buildFeedback, buildSummary, buildVitalQuestion, scheduleCheckins, initCheckinState, CHECKIN_TOTAL } from "./checkin";
import { getWeeklyPatterns, getVitalReadings, analyzeVitalTrend, buildMemoryObservation, buildEscalationAlert, shouldEscalate } from "./memory";
import { shouldAskWellness, buildWellnessCheck, buildWellnessResponse } from "./wellness";

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

function isYes(msg: string, lang: "en" | "ms" = "en") {
  if (lang === "ms") return /^(ya|y|1)$/i.test(msg.trim());
  return /^(yes|y|1)$/i.test(msg.trim());
}
function isNo(msg: string, lang: "en" | "ms" = "en") {
  if (lang === "ms") return /^(tidak|t|no|n|2)$/i.test(msg.trim());
  return /^(no|n|2)$/i.test(msg.trim());
}

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

    if (!user || !user.onboarded) {
      const reply = await handleOnboarding(from, incomingMsg);
      return sendTwiml(res, reply);
    }

    const caregiver = user.caregiverName ?? "there";
    const patient = user.patientName ?? "your patient";
    const lang = user.language ?? "en";

    // Handle escalation choice 1/2/3
    if (user.awaitingEscalationChoice) {
      const choice = incomingMsg.trim();
      await db.collection("users").doc(from).update({ awaitingEscalationChoice: false });
      if (lang === "ms") {
        const responses: Record<string, string> = {
          "1": `✅ Baik, ${caregiver}. Saya akan ingatkan anda tentang ubat ${patient} pada masa check-in seterusnya.`,
          "2": `📲 Direkodkan. Sila kongsikan ringkasan ini dengan ahli keluarga untuk sokongan.`,
          "3": `🏥 Teleconsult disyorkan. Sila hubungi doktor anda atau gunakan perkhidmatan telehealth untuk membuat temujanji bagi ${patient}.`,
        };
        return sendTwiml(res, responses[choice] ?? `Sila balas 1, 2, atau 3.`);
      }
      const responses: Record<string, string> = {
        "1": `✅ Got it, ${caregiver}. I'll remind you about ${patient}'s medication at the next check-in time.`,
        "2": `📲 Noted. Please share this summary with a family member so they can support you.`,
        "3": `🏥 Teleconsult recommended. Please contact your doctor or use your preferred telehealth service to book an appointment for ${patient}.`,
      };
      return sendTwiml(res, responses[choice] ?? `Please reply 1, 2, or 3 to choose an option.`);
    }

    // Handle wellness response
    if (user.awaitingWellnessResponse) {
      await db.collection("users").doc(from).update({ awaitingWellnessResponse: false });
      return sendTwiml(res, buildWellnessResponse(incomingMsg.trim(), caregiver, lang));
    }

    // Handle vital reading
    if (user.awaitingVital) {
      const vitalInput = incomingMsg.trim();
      const isSkip = /^(skip|langkau)$/i.test(vitalInput);
      await db.collection("users").doc(from).update({ awaitingVital: false });

      let trendAlert = "";
      if (!isSkip) {
        const today = new Date().toISOString().split("T")[0];
        await db.collection("checkins").doc(`${from}_${today}`).set({ vital: vitalInput }, { merge: true });
        const readings = await getVitalReadings(from);
        trendAlert = analyzeVitalTrend(readings, user.mainCondition ?? "", patient, lang);
      }

      // Chain to wellness check if due
      if (shouldAskWellness(user.lastWellnessCheck)) {
        const today = new Date().toISOString().split("T")[0];
        await db.collection("users").doc(from).update({
          awaitingWellnessResponse: true,
          lastWellnessCheck: today,
        });
        const ack = isSkip ? "" : (lang === "ms" ? `✅ Direkodkan: ${vitalInput}` : `✅ Recorded: ${vitalInput}`);
        return sendTwiml(res, `${ack}${trendAlert ? `\n\n${trendAlert}` : ""}${buildWellnessCheck(caregiver, lang)}`);
      }

      if (isSkip) return sendTwiml(res, lang === "ms" ? "Okay, direkodkan." : "Okay, noted.");
      const ack = lang === "ms" ? `✅ Direkodkan: ${vitalInput}` : `✅ Recorded: ${vitalInput}`;
      return sendTwiml(res, `${ack}${trendAlert ? `\n\n${trendAlert}` : ""}`);
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
        language: lang,
      });
      await db.collection("messages").add({
        incomingMsg, aiReply: triageReply, urgency: "Unknown", systemAction: "Triage assessment", from,
        createdAt: new Date().toISOString(),
      });
      return sendTwiml(res, triageReply);
    }

    // Handle active check-in yes/no flow
    if (user.checkinActive && (isYes(incomingMsg, lang) || isNo(incomingMsg, lang))) {
      const step = user.checkinStep ?? 0;
      const answered = isYes(incomingMsg, lang);
      const answer = answered ? (lang === "ms" ? "YA" : "YES") : (lang === "ms" ? "TIDAK" : "NO");
      const questionKey = ["medication", "meals", "concerns"][step];

      const today = new Date().toISOString().split("T")[0];
      await db.collection("checkins").doc(`${from}_${today}`)
        .set({ [questionKey]: answer, phone: from, date: today }, { merge: true });

      const result = buildFeedback(step, answered, caregiver, patient, lang);

      if (result.triggerAI) {
        await db.collection("users").doc(from).update({ awaitingConcernDetail: true });
        return sendTwiml(res, result.message);
      }

      if (result.showSummary) {
        const checkinDoc = await db.collection("checkins").doc(`${from}_${today}`).get();
        const data = (checkinDoc.data() ?? {}) as Record<string, string>;
        const summary = buildSummary(caregiver, patient, data, lang);
        const patterns = await getWeeklyPatterns(from);
        const escalation = shouldEscalate(patterns) ? buildEscalationAlert(patient, patterns, lang) : "";
        const updates: Record<string, unknown> = { checkinActive: false };

        if (shouldEscalate(patterns)) {
          updates.awaitingEscalationChoice = true;
          await db.collection("users").doc(from).update(updates);
          return sendTwiml(res, `${summary}${escalation}`);
        }

        const vitalQ = buildVitalQuestion(patient, user.mainCondition, lang);
        if (vitalQ) {
          updates.awaitingVital = true;
          await db.collection("users").doc(from).update(updates);
          return sendTwiml(res, `${summary}\n\n${vitalQ}`);
        }

        if (shouldAskWellness(user.lastWellnessCheck)) {
          updates.awaitingWellnessResponse = true;
          updates.lastWellnessCheck = today;
          await db.collection("users").doc(from).update(updates);
          return sendTwiml(res, `${summary}${buildWellnessCheck(caregiver, lang)}`);
        }

        await db.collection("users").doc(from).update(updates);
        return sendTwiml(res, summary);
      }

      const isLast = step + 1 >= CHECKIN_TOTAL;
      if (isLast) {
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
      return sendTwiml(res, lang === "ms"
        ? `💊 Senarai ubat dikemaskini untuk ${patient}:\n${meds}\n\nSaya akan gunakannya dalam semua penilaian akan datang.`
        : `💊 Medication list updated for ${patient}:\n${meds}\n\nI'll use this in all future assessments.`);
    }

    // Trigger check-in manually
    if (incomingMsg.trim().toLowerCase() === "/checkin") {
      await initCheckinState(from);
      const patterns = await getWeeklyPatterns(from);
      const readings = await getVitalReadings(from);
      const vitalAlert = readings.length > 0 ? analyzeVitalTrend(readings, user.mainCondition ?? "", patient, lang) : "";
      const observation = buildMemoryObservation(patient, patterns, lang, vitalAlert);
      const opening = buildOpeningMessage(caregiver, patient, lang);
      const fullMessage = observation ? `${observation}\n\n${opening}` : opening;
      return sendTwiml(res, fullMessage);
    }

    // Normal AI response
    const aiReply = await getAIResponse(incomingMsg, {
      caregiverName: caregiver,
      patientName: patient,
      condition: user.mainCondition,
      medications: user.medications,
      language: lang,
    });
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
