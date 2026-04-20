"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHECKIN_TOTAL = void 0;
exports.buildOpeningMessage = buildOpeningMessage;
exports.buildNextQuestion = buildNextQuestion;
exports.buildSummary = buildSummary;
exports.buildVitalQuestion = buildVitalQuestion;
exports.buildFeedback = buildFeedback;
exports.sendCheckinQuestion = sendCheckinQuestion;
exports.startCheckin = startCheckin;
exports.initCheckinState = initCheckinState;
exports.scheduleCheckins = scheduleCheckins;
const node_cron_1 = __importDefault(require("node-cron"));
const firebase_1 = require("./firebase");
const notify_1 = require("./notify");
const memory_1 = require("./memory");
const QUESTIONS = [
    {
        key: "medication",
        ask: (caregiver, patient, lang) => lang === "ms"
            ? `Hi ${caregiver} 👋\nMari kita semak ${patient} hari ini.\n\n1️⃣ Adakah ${patient} sudah ambil ubat?\nBalas *YA* atau *TIDAK*`
            : `Hi ${caregiver} 👋\nLet's check on ${patient} today.\n\n1️⃣ Has ${patient} taken their medication?\nReply *YES* or *NO*`,
        yes: (lang) => lang === "ms" ? "Bagus 👍 Terima kasih kerana mengesahkan." : "Great 👍 Thanks for confirming.",
        no: (lang) => lang === "ms" ? "Direkodkan 📝 Sila berikan ubat secepat mungkin." : "Noted 📝 Please make sure to give the medication as soon as possible.",
    },
    {
        key: "meals",
        ask: (_, patient, lang) => lang === "ms"
            ? `2️⃣ Adakah ${patient} sudah makan hari ini?\nBalas *YA* atau *TIDAK*`
            : `2️⃣ Has ${patient} eaten their meals today?\nReply *YES* or *NO*`,
        yes: (lang) => lang === "ms" ? "Bagus 😊 Pemakanan yang baik sangat penting." : "Wonderful 😊 Good nutrition matters a lot.",
        no: (lang) => lang === "ms" ? "Okay, cuba galakkan makanan atau cecair bila boleh." : "Okay, try to encourage some food or fluids when you can.",
    },
    {
        key: "concerns",
        ask: (_, patient, lang) => lang === "ms"
            ? `3️⃣ Ada sebarang kebimbangan tentang ${patient} hari ini?\nBalas *YA* atau *TIDAK*`
            : `3️⃣ Any concerns about ${patient} today?\nReply *YES* or *NO*`,
        yes: (lang) => lang === "ms" ? "Saya dengar anda 💙 Ceritakan apa yang berlaku dan saya akan bantu nilai." : "I hear you 💙 Feel free to describe what's happening and I'll help assess.",
        no: () => null,
    },
];
function buildOpeningMessage(caregiverName, patientName, lang = "en") {
    return QUESTIONS[0].ask(caregiverName, patientName, lang);
}
function buildNextQuestion(step, caregiverName, patientName, lang = "en") {
    return QUESTIONS[step].ask(caregiverName, patientName, lang);
}
function buildSummary(caregiverName, patientName, data, lang = "en") {
    const medOk = data.medication === "YES" || data.medication === "YA";
    const mealsOk = data.meals === "YES" || data.meals === "YA";
    const noConcerns = data.concerns !== "YES" && data.concerns !== "YA";
    const score = (medOk ? 50 : 0) + (mealsOk ? 15 : 0) + (noConcerns ? 35 : 0);
    let status;
    if (lang === "ms") {
        if (score === 100)
            status = "Sangat baik 💚";
        else if (score >= 80)
            status = "Sedikit berisiko 🟡";
        else if (score >= 50)
            status = "Perlu perhatian ⚠️";
        else
            status = "Risiko tinggi 🔴";
    }
    else {
        if (score === 100)
            status = "All good 💚";
        else if (score >= 80)
            status = "Slightly at risk 🟡";
        else if (score >= 50)
            status = "Needs attention ⚠️";
        else
            status = "High risk 🔴";
    }
    const med = medOk ? "✅" : "⚠️";
    const meals = mealsOk ? "✅" : "⚠️";
    const concernsLabel = noConcerns
        ? (lang === "ms" ? "Tiada 👍" : "None 👍")
        : (lang === "ms" ? "Ada 🔴" : "Flagged 🔴");
    if (lang === "ms") {
        return `📊 Skor Penjagaan ${patientName} Hari Ini: ${score}/100\n\n• Ubat: ${med}\n• Makan: ${meals}\n• Kebimbangan: ${concernsLabel}\n\nStatus: ${status}\n\nSaya akan terus memantau, ${caregiverName}. Hubungi saya bila ada perubahan 💙`;
    }
    return `📊 ${patientName}'s Care Score Today: ${score}/100\n\n• Medication: ${med}\n• Meals: ${meals}\n• Concerns: ${concernsLabel}\n\nStatus: ${status}\n\nI'll continue monitoring, ${caregiverName}. Let me know anytime if something changes 💙`;
}
function buildVitalQuestion(patientName, condition, lang = "en") {
    const cond = (condition ?? "").toLowerCase();
    if (!cond || cond === "other" || cond === "lain-lain")
        return null;
    if (lang === "ms") {
        if (cond.includes("diabetes"))
            return `💉 Satu lagi — berapakah bacaan gula darah ${patientName} hari ini?\n(cth: 7.2 mmol/L) — atau taip "langkau"`;
        if (cond.includes("hypertension") || cond.includes("darah tinggi"))
            return `🩺 Berapakah tekanan darah ${patientName} hari ini?\n(cth: 130/85) — atau taip "langkau"`;
        if (cond.includes("stroke") || cond.includes("strok") || cond.includes("dementia"))
            return `⭐ Bagaimana keadaan ${patientName} hari ini?\nBeri skor 1 (Teruk) hingga 5 (Sangat Baik) — atau taip "langkau"`;
        return null;
    }
    if (cond.includes("diabetes"))
        return `💉 One more — what was ${patientName}'s blood sugar today?\n(e.g., 7.2 mmol/L) — or type "skip"`;
    if (cond.includes("hypertension"))
        return `🩺 What was ${patientName}'s blood pressure today?\n(e.g., 130/85) — or type "skip"`;
    if (cond.includes("stroke") || cond.includes("dementia"))
        return `⭐ How would you rate ${patientName}'s overall condition today?\n1 (Poor) to 5 (Excellent) — or type "skip"`;
    return null;
}
function buildFeedback(step, isYes, caregiverName, patientName, lang = "en") {
    const isLast = step === QUESTIONS.length - 1;
    if (step === 0 && !isYes) {
        const nextQ = QUESTIONS[1].ask(caregiverName, patientName, lang);
        return lang === "ms"
            ? { message: `⚠️ Nampaknya ${patientName} mungkin terlepas ubat.\n\nSyorkan:\n• Berikan ubat jika selamat\n• Jika tidak pasti, semak preskripsi atau hubungi doktor\n\n${nextQ}` }
            : { message: `⚠️ It looks like ${patientName} may have missed medication.\n\nRecommended:\n• Give medication if safe to do so\n• If unsure, check prescription or contact doctor\n\n${nextQ}` };
    }
    if (step === 1 && !isYes) {
        const nextQ = QUESTIONS[2].ask(caregiverName, patientName, lang);
        return lang === "ms"
            ? { message: `⚠️ ${patientName} belum makan hari ini.\n\nCadangan:\n• Tawarkan makanan ringan (sup, bubur)\n• Galakkan makan sedikit-sedikit\n\n${nextQ}` }
            : { message: `⚠️ ${patientName} hasn't eaten today.\n\nSuggested:\n• Offer light foods (soup, porridge)\n• Encourage small frequent meals\n\n${nextQ}` };
    }
    if (isLast && isYes) {
        return {
            message: lang === "ms"
                ? `Saya dengar anda 💙 Apa kebimbangan yang anda perasan tentang ${patientName}?\n\nCeritakan apa yang berlaku dan saya akan bantu nilai.`
                : `I hear you 💙 What concerns are you noticing about ${patientName}?\n\nDescribe what's happening and I'll help you assess.`,
            triggerAI: true,
        };
    }
    if (isLast && !isYes) {
        return { message: "", showSummary: true };
    }
    const feedback = isYes ? QUESTIONS[step].yes(lang) : (QUESTIONS[step].no(lang) ?? "");
    const nextQ = QUESTIONS[step + 1].ask(caregiverName, patientName, lang);
    return { message: `${feedback}\n\n${nextQ}` };
}
exports.CHECKIN_TOTAL = QUESTIONS.length;
async function sendCheckinQuestion(phone, caregiverName, patientName, questionIndex, lang = "en") {
    await (0, notify_1.sendWhatsApp)(phone, QUESTIONS[questionIndex].ask(caregiverName, patientName, lang));
}
async function startCheckin(phone, caregiverName, patientName, lang = "en") {
    await firebase_1.db.collection("users").doc(phone).update({
        checkinActive: true,
        checkinStep: 0,
        checkinDate: new Date().toISOString().split("T")[0],
    });
    await sendCheckinQuestion(phone, caregiverName, patientName, 0, lang);
}
async function initCheckinState(phone) {
    await firebase_1.db.collection("users").doc(phone).update({
        checkinActive: true,
        checkinStep: 0,
        checkinDate: new Date().toISOString().split("T")[0],
    });
}
function parseCheckInTimes(checkInTime) {
    const results = [];
    const matches = checkInTime.match(/\d{1,2}(am|pm)/gi) ?? [];
    for (const t of matches) {
        const isPm = t.toLowerCase().includes("pm");
        const hour = parseInt(t) + (isPm && parseInt(t) !== 12 ? 12 : 0) - (!isPm && parseInt(t) === 12 ? 12 : 0);
        results.push(`${hour}:00`);
    }
    return results;
}
function parseReminderTimes(checkInTime) {
    return parseCheckInTimes(checkInTime).map(t => {
        const [h, m] = t.split(":").map(Number);
        const totalMin = h * 60 + m - 30;
        if (totalMin < 0)
            return null;
        return `${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, "0")}`;
    }).filter(Boolean);
}
function scheduleCheckins() {
    // Every-minute check-in scheduler + medication reminders + missed check-in family alert
    node_cron_1.default.schedule("* * * * *", async () => {
        const now = new Date();
        const hourStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
        const today = now.toISOString().split("T")[0];
        const snapshot = await firebase_1.db.collection("users").where("onboarded", "==", true).get();
        for (const doc of snapshot.docs) {
            const user = doc.data();
            if (!user.checkInTime)
                continue;
            const checkInTimes = parseCheckInTimes(user.checkInTime);
            const reminderTimes = parseReminderTimes(user.checkInTime);
            // Fire check-in
            if (checkInTimes.includes(hourStr)) {
                if (user.checkinDate === today && user.checkinActive !== false)
                    continue;
                console.log(`Starting check-in for ${user.phone}`);
                await startCheckin(user.phone, user.caregiverName ?? "there", user.patientName ?? "your patient", user.language ?? "en");
            }
            // Medication reminder 30 min before check-in
            if (reminderTimes.includes(hourStr) && user.medications) {
                const lang = user.language ?? "en";
                const reminder = lang === "ms"
                    ? `💊 Peringatan: Masa untuk ubat ${user.patientName ?? "pesakit"} akan tiba dalam 30 minit.\n\nUbat: ${user.medications}`
                    : `💊 Reminder: ${user.patientName ?? "your patient"}'s medication time is in 30 minutes.\n\nMedications: ${user.medications}`;
                try {
                    await (0, notify_1.sendWhatsApp)(user.phone, reminder);
                }
                catch (e) {
                    console.error(`Reminder failed for ${user.phone}:`, e);
                }
            }
            // Missed check-in alert to family — 2 hours after check-in time with no response
            if (user.familyPhone && user.checkinDate === today && user.checkinActive === true) {
                const startedHour = checkInTimes.find(t => {
                    const [h] = t.split(":").map(Number);
                    return now.getHours() - h >= 2;
                });
                if (startedHour && now.getMinutes() === 0) {
                    const lang = user.language ?? "en";
                    const alert = lang === "ms"
                        ? `⏰ KAI Alert untuk ${user.familyName ?? "Ahli Keluarga"}\n\n${user.caregiverName ?? "Penjaga"} belum menjawab semakan harian untuk ${user.patientName ?? "pesakit"} sejak 2 jam lalu.\n\nSila hubungi mereka.`
                        : `⏰ KAI Alert for ${user.familyName ?? "Family"}\n\n${user.caregiverName ?? "The caregiver"} hasn't responded to today's check-in for ${user.patientName ?? "the patient"} in over 2 hours.\n\nPlease reach out to them.`;
                    try {
                        await (0, notify_1.sendWhatsApp)(user.familyPhone, alert);
                    }
                    catch (e) {
                        console.error(`Family alert failed for ${user.familyPhone}:`, e);
                    }
                }
            }
        }
    });
    // Weekly summary to family — every Sunday at 8pm
    node_cron_1.default.schedule("0 20 * * 0", async () => {
        console.log("Running weekly family summary...");
        const snapshot = await firebase_1.db.collection("users").where("onboarded", "==", true).get();
        for (const doc of snapshot.docs) {
            const user = doc.data();
            if (!user.familyPhone)
                continue;
            try {
                const patterns = await (0, memory_1.getWeeklyPatterns)(user.phone);
                const summary = (0, memory_1.buildWeeklySummaryMessage)(user.caregiverName ?? "the caregiver", user.patientName ?? "the patient", patterns, user.language ?? "en");
                await (0, notify_1.sendWhatsApp)(user.familyPhone, summary);
                console.log(`Weekly summary sent to family of ${user.phone}`);
            }
            catch (e) {
                console.error(`Weekly summary failed for ${user.phone}:`, e);
            }
        }
    });
    console.log("Check-in scheduler running");
}
