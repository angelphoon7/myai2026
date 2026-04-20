import 'dotenv/config';
import express, { Request, Response } from "express";
import { getAIResponse } from "./ai";
import { getTriageResponse } from "./triage";
import { db } from "./firebase";
import { getUser, handleOnboarding, UserProfile } from "./onboarding";
import { buildOpeningMessage, buildFeedback, buildSummary, buildVitalQuestion, scheduleCheckins, initCheckinState, CHECKIN_TOTAL } from "./checkin";
import { getWeeklyPatterns, getVitalReadings, analyzeVitalTrend, buildMemoryObservation, buildEscalationAlert, shouldEscalate, shouldWarnBurnout, buildWeeklySummaryMessage, saveSymptomNote, getRecentSymptomNotes } from "./memory";
import { shouldAskWellness, buildWellnessCheck, buildWellnessResponse } from "./wellness";
import { sendWhatsApp, sendWhatsAppLong } from "./notify";
import { checkDrugInteractions, formatInteractionWarnings } from "./medical-api";
import { downloadTwilioImage, analyzeImage } from "./vision";

const DOCTORONCALL = "https://www.doctoroncall.com.my";
const KKMAPP = "https://kkmapp.moh.gov.my";

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

async function notifyFamily(user: UserProfile, message: string) {
  if (!user.familyPhone) return;
  try {
    await sendWhatsApp(user.familyPhone, message);
    console.log(`Family notified: ${user.familyPhone}`);
  } catch (e) {
    console.error("Family notification failed:", e);
  }
}

function injectTeleconsultLinks(triageReply: string, lang: "en" | "ms"): string {
  if (triageReply.includes("CLINIC TODAY")) {
    const linkLine = lang === "ms"
      ? `\n\n🏥 Tempah sekarang:\n• DoctorOnCall: ${DOCTORONCALL}\n• KKMNow: ${KKMAPP}`
      : `\n\n🏥 Book now:\n• DoctorOnCall: ${DOCTORONCALL}\n• KKMNow: ${KKMAPP}`;
    return triageReply + linkLine;
  }
  return triageReply;
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

    // Photo triage — KAI Eyes (respond immediately to beat Twilio's 15s timeout, process async)
    const numMedia = parseInt(req.body.NumMedia || "0", 10);
    console.log("NumMedia:", numMedia, "| Body:", incomingMsg);
    if (numMedia > 0) {
      const mediaUrl: string = req.body.MediaUrl0;
      const mediaType: string = req.body.MediaContentType0 || "image/jpeg";
      const caption = incomingMsg.trim() || undefined;

      // Acknowledge immediately — analysis runs in background
      const ack = lang === "ms"
        ? `👁️ KAI Eyes sedang menganalisis gambar anda... Keputusan akan dihantar dalam beberapa saat.`
        : `👁️ KAI Eyes is analyzing your photo... Results will arrive in a few seconds.`;
      sendTwiml(res, ack);

      // Process async — send result via Twilio API (not webhook response)
      setImmediate(async () => {
        try {
          const [{ base64, mimeType }, recentSymptoms] = await Promise.all([
            downloadTwilioImage(mediaUrl),
            getRecentSymptomNotes(from),
          ]);
          const visionReply = await analyzeImage(
            {
              caregiverName: caregiver,
              patientName: patient,
              patientAge: user.patientAge,
              condition: user.mainCondition,
              medications: user.medications,
              language: lang,
              caption,
              recentSymptoms,
            },
            base64,
            mimeType
          );

          await sendWhatsAppLong(from, visionReply);

          if (visionReply.includes("GO TO A&E NOW") || visionReply.includes("KE A&E SEKARANG")) {
            const aeAlert = lang === "ms"
              ? `🚨 KAI Eyes Alert\n\n${caregiver} telah menghantar gambar dan dinasihatkan ke A&E dengan segera untuk ${patient}.\n\nSila hubungi mereka sekarang.`
              : `🚨 KAI Eyes Alert\n\n${caregiver} sent a photo and has been advised to take ${patient} to A&E immediately.\n\nPlease call them now.`;
            await notifyFamily(user, aeAlert);
          }

          if (visionReply.includes("⚠️ Mismatch") || visionReply.includes("not on") || visionReply.includes("Do not give")) {
            const medAlert = lang === "ms"
              ? `💊 KAI Eyes — Amaran Ubat\n\n${caregiver} mengimbas ubat untuk ${patient} dan terdapat kemungkinan ketidakpadanan. Sila semak segera.`
              : `💊 KAI Eyes — Medication Alert\n\n${caregiver} scanned a medication for ${patient} and a possible mismatch was detected. Please verify immediately.`;
            await notifyFamily(user, medAlert);
          }

          await db.collection("messages").add({
            type: "vision", mediaUrl, mediaType,
            caption: caption ?? null, aiReply: visionReply, from,
            createdAt: new Date().toISOString(),
          });
        } catch (err: any) {
          console.error("Vision analysis failed:", err);
          // Send actual error for debugging
          await sendWhatsApp(from, `[DEBUG] Vision failed: ${err.message?.substring(0, 200) ?? String(err).substring(0, 200)}`);
        }
      });

      return;
    }

    // Handle escalation choice 1/2/3
    if (user.awaitingEscalationChoice) {
      const choice = incomingMsg.trim();
      await db.collection("users").doc(from).update({ awaitingEscalationChoice: false });

      // Choice 2: actually notify the family member via WhatsApp
      if (choice === "2") {
        const patterns = await getWeeklyPatterns(from);
        const summary = buildWeeklySummaryMessage(caregiver, patient, patterns, lang);
        const familyMsg = lang === "ms"
          ? `📋 KAI — Penjaga ${caregiver} meminta anda dihubungi.\n\n${summary}`
          : `📋 KAI — Caregiver ${caregiver} has requested you be notified.\n\n${summary}`;
        await notifyFamily(user, familyMsg);
      }

      if (lang === "ms") {
        const responses: Record<string, string> = {
          "1": `✅ Baik, ${caregiver}. Saya akan ingatkan anda tentang ubat ${patient} pada masa check-in seterusnya.`,
          "2": user.familyPhone
            ? `📲 Mesej telah dihantar kepada ${user.familyName ?? "ahli keluarga"} anda.`
            : `📲 Tiada kenalan kecemasan disimpan. Sila kongsikan secara manual.`,
          "3": `🏥 Teleconsult disyorkan. Tempah di sini:\n• DoctorOnCall: ${DOCTORONCALL}\n• KKMNow: ${KKMAPP}`,
        };
        return sendTwiml(res, responses[choice] ?? `Sila balas 1, 2, atau 3.`);
      }
      const responses: Record<string, string> = {
        "1": `✅ Got it, ${caregiver}. I'll remind you about ${patient}'s medication at the next check-in time.`,
        "2": user.familyPhone
          ? `📲 Message sent to ${user.familyName ?? "your family member"}.`
          : `📲 No emergency contact saved. Please share manually.`,
        "3": `🏥 Teleconsult recommended. Book here:\n• DoctorOnCall: ${DOCTORONCALL}\n• KKMNow: ${KKMAPP}`,
      };
      return sendTwiml(res, responses[choice] ?? `Please reply 1, 2, or 3 to choose an option.`);
    }

    // Handle wellness response
    if (user.awaitingWellnessResponse) {
      await db.collection("users").doc(from).update({ awaitingWellnessResponse: false });
      const response = buildWellnessResponse(incomingMsg.trim(), caregiver, lang);

      // If caregiver is really struggling, quietly alert family
      if (incomingMsg.trim() === "3" && user.familyPhone) {
        const burnoutAlert = lang === "ms"
          ? `💙 KAI Notice — ${caregiver} menyatakan mereka sangat tertekan hari ini semasa menjaga ${patient}.\n\nSila hubungi dan tawarkan sokongan jika boleh.`
          : `💙 KAI Notice — ${caregiver} indicated they are really struggling today while caring for ${patient}.\n\nPlease reach out and offer support if you can.`;
        await notifyFamily(user, burnoutAlert);
      }

      return sendTwiml(res, response);
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

        // Notify family if vital is critically abnormal
        if (trendAlert.includes("🚨") && user.familyPhone) {
          await notifyFamily(user, `🚨 KAI Alert\n\n${trendAlert}\n\nCaregiver: ${caregiver}`);
        }
      }

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
      await saveSymptomNote(from, incomingMsg);
      const patterns = await getWeeklyPatterns(from);
      let triageReply = await getTriageResponse(incomingMsg, {
        caregiverName: caregiver,
        patientName: patient,
        patientAge: user.patientAge,
        condition: user.mainCondition,
        medications: user.medications,
        missedMedDays: patterns.missedMedication,
        skippedMealDays: patterns.skippedMeals,
        language: lang,
      });

      // Inject teleconsult links if clinic recommended
      triageReply = injectTeleconsultLinks(triageReply, lang);

      // Notify family immediately if A&E
      if (triageReply.includes("GO TO A&E NOW") || triageReply.includes("KE A&E SEKARANG")) {
        const aeAlert = lang === "ms"
          ? `🚨 KECEMASAN — KAI Alert\n\n${caregiver} telah dinasihatkan untuk membawa ${patient} ke A&E dengan segera.\n\nSila hubungi mereka sekarang.`
          : `🚨 EMERGENCY — KAI Alert\n\n${caregiver} has been advised to take ${patient} to A&E immediately.\n\nPlease call them now.`;
        await notifyFamily(user, aeAlert);
      }

      // Alert family if burnout pattern detected
      if (shouldWarnBurnout(patterns) && user.familyPhone) {
        const burnoutAlert = lang === "ms"
          ? `💙 KAI Notice\n\n${caregiver} telah melaporkan kebimbangan ${patterns.raisedConcerns}x minggu ini semasa menjaga ${patient}. Mereka mungkin memerlukan sokongan.`
          : `💙 KAI Notice\n\n${caregiver} has raised concerns ${patterns.raisedConcerns} times this week while caring for ${patient}. They may need your support.`;
        await notifyFamily(user, burnoutAlert);
      }

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
    if (incomingMsg.trim().toLowerCase() === "/updatemeds") {
      return sendTwiml(res, lang === "ms"
        ? `💊 Sila nyatakan senarai ubat selepas arahan.\n\nContoh:\n/updatemeds Metformin 500mg, Amlodipine 5mg, Insulin glulisine 100IU`
        : `💊 Please list the medications after the command.\n\nExample:\n/updatemeds Metformin 500mg, Amlodipine 5mg, Insulin glulisine 100IU`);
    }
    if (incomingMsg.trim().toLowerCase().startsWith("/updatemeds ")) {
      const meds = incomingMsg.trim().slice(12).trim();
      await db.collection("users").doc(from).update({ medications: meds });

      const base = lang === "ms"
        ? `💊 Senarai ubat dikemaskini untuk ${patient}:\n${meds}\n\nSaya akan gunakannya dalam semua penilaian akan datang.`
        : `💊 Medication list updated for ${patient}:\n${meds}\n\nI'll use this in all future assessments.`;

      const interactions = await checkDrugInteractions(meds);
      const interactionBlock = formatInteractionWarnings(interactions, lang);
      return sendTwiml(res, base + interactionBlock);
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

    // Notify family on emergency urgency from free-text AI
    if (urgency === "Emergency") {
      const emergencyAlert = lang === "ms"
        ? `🚨 KAI Alert — ${caregiver} mungkin menghadapi situasi kecemasan dengan ${patient}. Sila hubungi mereka segera.`
        : `🚨 KAI Alert — ${caregiver} may be facing an emergency with ${patient}. Please contact them immediately.`;
      await notifyFamily(user, emergencyAlert);
    }

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
