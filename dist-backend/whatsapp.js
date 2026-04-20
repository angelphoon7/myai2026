"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const ai_1 = require("./ai");
const triage_1 = require("./triage");
const firebase_1 = require("./firebase");
const onboarding_1 = require("./onboarding");
const checkin_1 = require("./checkin");
const memory_1 = require("./memory");
const wellness_1 = require("./wellness");
const notify_1 = require("./notify");
const medical_api_1 = require("./medical-api");
const vision_1 = require("./vision");
const DOCTORONCALL = "https://www.doctoroncall.com.my";
const KKMAPP = "https://kkmapp.moh.gov.my";
const app = (0, express_1.default)();
app.use(express_1.default.urlencoded({ extended: false }));
function extractUrgency(text) {
    if (text.includes("Urgency: Emergency"))
        return "Emergency";
    if (text.includes("Urgency: Medium"))
        return "Medium";
    if (text.includes("Urgency: Low"))
        return "Low";
    return "Unknown";
}
function escapeXml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
function isYes(msg, lang = "en") {
    if (lang === "ms")
        return /^(ya|y|1)$/i.test(msg.trim());
    return /^(yes|y|1)$/i.test(msg.trim());
}
function isNo(msg, lang = "en") {
    if (lang === "ms")
        return /^(tidak|t|no|n|2)$/i.test(msg.trim());
    return /^(no|n|2)$/i.test(msg.trim());
}
function sendTwiml(res, text) {
    res.set("Content-Type", "text/xml");
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(text)}</Message>
</Response>`);
}
async function notifyFamily(user, message) {
    if (!user.familyPhone)
        return;
    try {
        await (0, notify_1.sendWhatsApp)(user.familyPhone, message);
        console.log(`Family notified: ${user.familyPhone}`);
    }
    catch (e) {
        console.error("Family notification failed:", e);
    }
}
function injectTeleconsultLinks(triageReply, lang) {
    if (triageReply.includes("CLINIC TODAY")) {
        const linkLine = lang === "ms"
            ? `\n\n🏥 Tempah sekarang:\n• DoctorOnCall: ${DOCTORONCALL}\n• KKMNow: ${KKMAPP}`
            : `\n\n🏥 Book now:\n• DoctorOnCall: ${DOCTORONCALL}\n• KKMNow: ${KKMAPP}`;
        return triageReply + linkLine;
    }
    return triageReply;
}
app.post("/webhook", async (req, res) => {
    try {
        const incomingMsg = req.body.Body || "";
        const from = req.body.From || "";
        console.log("Incoming:", incomingMsg, "From:", from);
        const user = await (0, onboarding_1.getUser)(from);
        if (!user || !user.onboarded) {
            const reply = await (0, onboarding_1.handleOnboarding)(from, incomingMsg);
            return sendTwiml(res, reply);
        }
        const caregiver = user.caregiverName ?? "there";
        const patient = user.patientName ?? "your patient";
        const lang = user.language ?? "en";
        // Photo triage — KAI Eyes (respond immediately to beat Twilio's 15s timeout, process async)
        const numMedia = parseInt(req.body.NumMedia || "0", 10);
        console.log("NumMedia:", numMedia, "| Body:", incomingMsg);
        if (numMedia > 0) {
            const mediaUrl = req.body.MediaUrl0;
            const mediaType = req.body.MediaContentType0 || "image/jpeg";
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
                        (0, vision_1.downloadTwilioImage)(mediaUrl),
                        (0, memory_1.getRecentSymptomNotes)(from),
                    ]);
                    const visionReply = await (0, vision_1.analyzeImage)({
                        caregiverName: caregiver,
                        patientName: patient,
                        patientAge: user.patientAge,
                        condition: user.mainCondition,
                        medications: user.medications,
                        language: lang,
                        caption,
                        recentSymptoms,
                    }, base64, mimeType);
                    await (0, notify_1.sendWhatsAppLong)(from, visionReply);
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
                    await firebase_1.db.collection("messages").add({
                        type: "vision", mediaUrl, mediaType,
                        caption: caption ?? null, aiReply: visionReply, from,
                        createdAt: new Date().toISOString(),
                    });
                }
                catch (err) {
                    console.error("Vision analysis failed:", err);
                    // Send actual error for debugging
                    await (0, notify_1.sendWhatsApp)(from, `[DEBUG] Vision failed: ${err.message?.substring(0, 200) ?? String(err).substring(0, 200)}`);
                }
            });
            return;
        }
        // Handle escalation choice 1/2/3
        if (user.awaitingEscalationChoice) {
            const choice = incomingMsg.trim();
            await firebase_1.db.collection("users").doc(from).update({ awaitingEscalationChoice: false });
            // Choice 2: actually notify the family member via WhatsApp
            if (choice === "2") {
                const patterns = await (0, memory_1.getWeeklyPatterns)(from);
                const summary = (0, memory_1.buildWeeklySummaryMessage)(caregiver, patient, patterns, lang);
                const familyMsg = lang === "ms"
                    ? `📋 KAI — Penjaga ${caregiver} meminta anda dihubungi.\n\n${summary}`
                    : `📋 KAI — Caregiver ${caregiver} has requested you be notified.\n\n${summary}`;
                await notifyFamily(user, familyMsg);
            }
            if (lang === "ms") {
                const responses = {
                    "1": `✅ Baik, ${caregiver}. Saya akan ingatkan anda tentang ubat ${patient} pada masa check-in seterusnya.`,
                    "2": user.familyPhone
                        ? `📲 Mesej telah dihantar kepada ${user.familyName ?? "ahli keluarga"} anda.`
                        : `📲 Tiada kenalan kecemasan disimpan. Sila kongsikan secara manual.`,
                    "3": `🏥 Teleconsult disyorkan. Tempah di sini:\n• DoctorOnCall: ${DOCTORONCALL}\n• KKMNow: ${KKMAPP}`,
                };
                return sendTwiml(res, responses[choice] ?? `Sila balas 1, 2, atau 3.`);
            }
            const responses = {
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
            await firebase_1.db.collection("users").doc(from).update({ awaitingWellnessResponse: false });
            const response = (0, wellness_1.buildWellnessResponse)(incomingMsg.trim(), caregiver, lang);
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
            await firebase_1.db.collection("users").doc(from).update({ awaitingVital: false });
            let trendAlert = "";
            if (!isSkip) {
                const today = new Date().toISOString().split("T")[0];
                await firebase_1.db.collection("checkins").doc(`${from}_${today}`).set({ vital: vitalInput }, { merge: true });
                const readings = await (0, memory_1.getVitalReadings)(from);
                trendAlert = (0, memory_1.analyzeVitalTrend)(readings, user.mainCondition ?? "", patient, lang);
                // Notify family if vital is critically abnormal
                if (trendAlert.includes("🚨") && user.familyPhone) {
                    await notifyFamily(user, `🚨 KAI Alert\n\n${trendAlert}\n\nCaregiver: ${caregiver}`);
                }
            }
            if ((0, wellness_1.shouldAskWellness)(user.lastWellnessCheck)) {
                const today = new Date().toISOString().split("T")[0];
                await firebase_1.db.collection("users").doc(from).update({
                    awaitingWellnessResponse: true,
                    lastWellnessCheck: today,
                });
                const ack = isSkip ? "" : (lang === "ms" ? `✅ Direkodkan: ${vitalInput}` : `✅ Recorded: ${vitalInput}`);
                return sendTwiml(res, `${ack}${trendAlert ? `\n\n${trendAlert}` : ""}${(0, wellness_1.buildWellnessCheck)(caregiver, lang)}`);
            }
            if (isSkip)
                return sendTwiml(res, lang === "ms" ? "Okay, direkodkan." : "Okay, noted.");
            const ack = lang === "ms" ? `✅ Direkodkan: ${vitalInput}` : `✅ Recorded: ${vitalInput}`;
            return sendTwiml(res, `${ack}${trendAlert ? `\n\n${trendAlert}` : ""}`);
        }
        // Handle concern detail → triage assessment
        if (user.awaitingConcernDetail) {
            await firebase_1.db.collection("users").doc(from).update({ awaitingConcernDetail: false, checkinActive: false });
            await (0, memory_1.saveSymptomNote)(from, incomingMsg);
            const patterns = await (0, memory_1.getWeeklyPatterns)(from);
            let triageReply = await (0, triage_1.getTriageResponse)(incomingMsg, {
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
            if ((0, memory_1.shouldWarnBurnout)(patterns) && user.familyPhone) {
                const burnoutAlert = lang === "ms"
                    ? `💙 KAI Notice\n\n${caregiver} telah melaporkan kebimbangan ${patterns.raisedConcerns}x minggu ini semasa menjaga ${patient}. Mereka mungkin memerlukan sokongan.`
                    : `💙 KAI Notice\n\n${caregiver} has raised concerns ${patterns.raisedConcerns} times this week while caring for ${patient}. They may need your support.`;
                await notifyFamily(user, burnoutAlert);
            }
            await firebase_1.db.collection("messages").add({
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
            await firebase_1.db.collection("checkins").doc(`${from}_${today}`)
                .set({ [questionKey]: answer, phone: from, date: today }, { merge: true });
            const result = (0, checkin_1.buildFeedback)(step, answered, caregiver, patient, lang);
            if (result.triggerAI) {
                await firebase_1.db.collection("users").doc(from).update({ awaitingConcernDetail: true });
                return sendTwiml(res, result.message);
            }
            if (result.showSummary) {
                const checkinDoc = await firebase_1.db.collection("checkins").doc(`${from}_${today}`).get();
                const data = (checkinDoc.data() ?? {});
                const summary = (0, checkin_1.buildSummary)(caregiver, patient, data, lang);
                const patterns = await (0, memory_1.getWeeklyPatterns)(from);
                const escalation = (0, memory_1.shouldEscalate)(patterns) ? (0, memory_1.buildEscalationAlert)(patient, patterns, lang) : "";
                const updates = { checkinActive: false };
                if ((0, memory_1.shouldEscalate)(patterns)) {
                    updates.awaitingEscalationChoice = true;
                    await firebase_1.db.collection("users").doc(from).update(updates);
                    return sendTwiml(res, `${summary}${escalation}`);
                }
                const vitalQ = (0, checkin_1.buildVitalQuestion)(patient, user.mainCondition, lang);
                if (vitalQ) {
                    updates.awaitingVital = true;
                    await firebase_1.db.collection("users").doc(from).update(updates);
                    return sendTwiml(res, `${summary}\n\n${vitalQ}`);
                }
                if ((0, wellness_1.shouldAskWellness)(user.lastWellnessCheck)) {
                    updates.awaitingWellnessResponse = true;
                    updates.lastWellnessCheck = today;
                    await firebase_1.db.collection("users").doc(from).update(updates);
                    return sendTwiml(res, `${summary}${(0, wellness_1.buildWellnessCheck)(caregiver, lang)}`);
                }
                await firebase_1.db.collection("users").doc(from).update(updates);
                return sendTwiml(res, summary);
            }
            const isLast = step + 1 >= checkin_1.CHECKIN_TOTAL;
            if (isLast) {
                await firebase_1.db.collection("users").doc(from).update({ checkinActive: false });
            }
            else {
                await firebase_1.db.collection("users").doc(from).update({ checkinStep: step + 1 });
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
            await firebase_1.db.collection("users").doc(from).update({ medications: meds });
            const base = lang === "ms"
                ? `💊 Senarai ubat dikemaskini untuk ${patient}:\n${meds}\n\nSaya akan gunakannya dalam semua penilaian akan datang.`
                : `💊 Medication list updated for ${patient}:\n${meds}\n\nI'll use this in all future assessments.`;
            const interactions = await (0, medical_api_1.checkDrugInteractions)(meds);
            const interactionBlock = (0, medical_api_1.formatInteractionWarnings)(interactions, lang);
            return sendTwiml(res, base + interactionBlock);
        }
        // Trigger check-in manually
        if (incomingMsg.trim().toLowerCase() === "/checkin") {
            await (0, checkin_1.initCheckinState)(from);
            const patterns = await (0, memory_1.getWeeklyPatterns)(from);
            const readings = await (0, memory_1.getVitalReadings)(from);
            const vitalAlert = readings.length > 0 ? (0, memory_1.analyzeVitalTrend)(readings, user.mainCondition ?? "", patient, lang) : "";
            const observation = (0, memory_1.buildMemoryObservation)(patient, patterns, lang, vitalAlert);
            const opening = (0, checkin_1.buildOpeningMessage)(caregiver, patient, lang);
            const fullMessage = observation ? `${observation}\n\n${opening}` : opening;
            return sendTwiml(res, fullMessage);
        }
        // Normal AI response
        const aiReply = await (0, ai_1.getAIResponse)(incomingMsg, {
            caregiverName: caregiver,
            patientName: patient,
            condition: user.mainCondition,
            medications: user.medications,
            language: lang,
        });
        console.log("AI reply:", aiReply);
        const urgency = extractUrgency(aiReply);
        let systemAction = "No action";
        if (urgency === "Low")
            systemAction = "Monitoring started";
        else if (urgency === "Medium")
            systemAction = "Teleconsult should be booked";
        else if (urgency === "Emergency")
            systemAction = "Emergency services should be alerted immediately";
        // Notify family on emergency urgency from free-text AI
        if (urgency === "Emergency") {
            const emergencyAlert = lang === "ms"
                ? `🚨 KAI Alert — ${caregiver} mungkin menghadapi situasi kecemasan dengan ${patient}. Sila hubungi mereka segera.`
                : `🚨 KAI Alert — ${caregiver} may be facing an emergency with ${patient}. Please contact them immediately.`;
            await notifyFamily(user, emergencyAlert);
        }
        console.log("Detected urgency:", urgency, "| System action:", systemAction);
        await firebase_1.db.collection("messages").add({
            incomingMsg, aiReply, urgency, systemAction, from,
            createdAt: new Date().toISOString(),
        });
        return sendTwiml(res, `${aiReply}\nSystem Action: ${systemAction}`);
    }
    catch (error) {
        console.error("Webhook error:", error);
        return sendTwiml(res, "Sorry, KAI hit an error. Please try again.");
    }
});
app.get("/", (_req, res) => {
    res.send("KAI bot is running");
});
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    (0, checkin_1.scheduleCheckins)();
});
