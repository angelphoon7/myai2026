import 'dotenv/config';
import express, { Request, Response } from "express";
import { getAIResponse } from "./ai";
import { db } from "./firebase";
import { getUser, handleOnboarding } from "./onboarding";
import { CHECKIN_QUESTIONS, sendCheckinQuestion, scheduleCheckins, initCheckinState } from "./checkin";

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

function isYes(msg: string) {
  return /^(yes|y|1)$/i.test(msg.trim());
}

function isNo(msg: string) {
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

    // Onboarding for new users
    if (!user || !user.onboarded) {
      const reply = await handleOnboarding(from, incomingMsg);
      return sendTwiml(res, reply);
    }

    // Handle active check-in yes/no flow
    if (user.checkinActive && (isYes(incomingMsg) || isNo(incomingMsg))) {
      const step = user.checkinStep ?? 0;
      const answer = isYes(incomingMsg) ? "YES" : "NO";
      const questionKey = ["medication", "meals", "concerns"][step];

      // Save this answer
      const today = new Date().toISOString().split("T")[0];
      const checkinRef = db.collection("checkins").doc(`${from}_${today}`);
      await checkinRef.set({ [questionKey]: answer, phone: from, date: today }, { merge: true });

      const nextStep = step + 1;

      if (nextStep < CHECKIN_QUESTIONS.length) {
        // Ask next question
        await db.collection("users").doc(from).update({ checkinStep: nextStep });
        await sendCheckinQuestion(from, user.patientName ?? "your patient", nextStep);
        return sendTwiml(res, "");
      } else {
        // All questions answered
        await db.collection("users").doc(from).update({ checkinActive: false });
        return sendTwiml(res, `Check-in complete for today. Thank you for caring for ${user.patientName}!`);
      }
    }

    // Trigger check-in manually
    if (incomingMsg.trim().toLowerCase() === '/checkin') {
      await initCheckinState(from);
      const q = CHECKIN_QUESTIONS[0].replace('{patient}', user.patientName ?? 'your patient');
      return sendTwiml(res, `KAI Check-in (1/${CHECKIN_QUESTIONS.length})\n\n${q}`);
    }

    // Normal AI response
    const aiReply = await getAIResponse(incomingMsg);
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
