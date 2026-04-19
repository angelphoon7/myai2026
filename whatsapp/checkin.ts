import cron from "node-cron";
import twilio from "twilio";
import { db } from "./firebase";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM = "whatsapp:+14155238886";

type Lang = "en" | "ms";

interface Question {
  key: string;
  ask: (caregiver: string, patient: string, lang: Lang) => string;
  yes: (lang: Lang) => string;
  no: (lang: Lang) => string | null;
}

const QUESTIONS: Question[] = [
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

export function buildOpeningMessage(caregiverName: string, patientName: string, lang: Lang = "en"): string {
  return QUESTIONS[0].ask(caregiverName, patientName, lang);
}

export function buildNextQuestion(step: number, caregiverName: string, patientName: string, lang: Lang = "en"): string {
  return QUESTIONS[step].ask(caregiverName, patientName, lang);
}

export type FeedbackResult = {
  message: string;
  triggerAI?: boolean;
  showSummary?: boolean;
};

export function buildSummary(caregiverName: string, patientName: string, data: Record<string, string>, lang: Lang = "en"): string {
  const medOk = data.medication === "YES" || data.medication === "YA";
  const mealsOk = data.meals === "YES" || data.meals === "YA";
  const noConcerns = data.concerns !== "YES" && data.concerns !== "YA";

  const score = (medOk ? 50 : 0) + (mealsOk ? 15 : 0) + (noConcerns ? 35 : 0);

  let status: string;
  if (lang === "ms") {
    if (score === 100) status = "Sangat baik 💚";
    else if (score >= 80) status = "Sedikit berisiko 🟡";
    else if (score >= 50) status = "Perlu perhatian ⚠️";
    else status = "Risiko tinggi 🔴";
  } else {
    if (score === 100) status = "All good 💚";
    else if (score >= 80) status = "Slightly at risk 🟡";
    else if (score >= 50) status = "Needs attention ⚠️";
    else status = "High risk 🔴";
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

export function buildVitalQuestion(patientName: string, condition?: string, lang: Lang = "en"): string | null {
  const cond = (condition ?? "").toLowerCase();
  if (!cond || cond === "other" || cond === "lain-lain") return null;

  if (lang === "ms") {
    if (cond.includes("diabetes")) return `💉 Satu lagi — berapakah bacaan gula darah ${patientName} hari ini?\n(cth: 7.2 mmol/L) — atau taip "langkau"`;
    if (cond.includes("hypertension") || cond.includes("darah tinggi")) return `🩺 Berapakah tekanan darah ${patientName} hari ini?\n(cth: 130/85) — atau taip "langkau"`;
    if (cond.includes("stroke") || cond.includes("strok") || cond.includes("dementia")) return `⭐ Bagaimana keadaan ${patientName} hari ini?\nBeri skor 1 (Teruk) hingga 5 (Sangat Baik) — atau taip "langkau"`;
    return null;
  }

  if (cond.includes("diabetes")) return `💉 One more — what was ${patientName}'s blood sugar today?\n(e.g., 7.2 mmol/L) — or type "skip"`;
  if (cond.includes("hypertension")) return `🩺 What was ${patientName}'s blood pressure today?\n(e.g., 130/85) — or type "skip"`;
  if (cond.includes("stroke") || cond.includes("dementia")) return `⭐ How would you rate ${patientName}'s overall condition today?\n1 (Poor) to 5 (Excellent) — or type "skip"`;
  return null;
}

export function buildFeedback(step: number, isYes: boolean, caregiverName: string, patientName: string, lang: Lang = "en"): FeedbackResult {
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

export const CHECKIN_TOTAL = QUESTIONS.length;

export async function sendCheckinQuestion(phone: string, caregiverName: string, patientName: string, questionIndex: number, lang: Lang = "en") {
  await client.messages.create({
    from: FROM,
    to: phone,
    body: QUESTIONS[questionIndex].ask(caregiverName, patientName, lang),
  });
}

export async function startCheckin(phone: string, caregiverName: string, patientName: string, lang: Lang = "en") {
  await db.collection("users").doc(phone).update({
    checkinActive: true,
    checkinStep: 0,
    checkinDate: new Date().toISOString().split("T")[0],
  });
  await sendCheckinQuestion(phone, caregiverName, patientName, 0, lang);
}

export async function initCheckinState(phone: string) {
  await db.collection("users").doc(phone).update({
    checkinActive: true,
    checkinStep: 0,
    checkinDate: new Date().toISOString().split("T")[0],
  });
}

export function scheduleCheckins() {
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const hourStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;

    const snapshot = await db.collection("users").where("onboarded", "==", true).get();

    for (const doc of snapshot.docs) {
      const user = doc.data();
      if (!user.checkInTime) continue;

      const times = parseCheckInTimes(user.checkInTime);
      if (!times.includes(hourStr)) continue;

      const today = now.toISOString().split("T")[0];
      if (user.checkinDate === today && user.checkinActive !== false) continue;

      console.log(`Starting check-in for ${user.phone}`);
      await startCheckin(user.phone, user.caregiverName ?? "there", user.patientName ?? "your patient", user.language ?? "en");
    }
  });

  console.log("Check-in scheduler running");
}

function parseCheckInTimes(checkInTime: string): string[] {
  const results: string[] = [];
  const matches = checkInTime.match(/\d{1,2}(am|pm)/gi) ?? [];
  for (const t of matches) {
    const isPm = t.toLowerCase().includes("pm");
    const hour = parseInt(t) + (isPm && parseInt(t) !== 12 ? 12 : 0) - (!isPm && parseInt(t) === 12 ? 12 : 0);
    results.push(`${hour}:00`);
  }
  return results;
}
