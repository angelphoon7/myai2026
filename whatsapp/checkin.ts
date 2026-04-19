import cron from "node-cron";
import twilio from "twilio";
import { db } from "./firebase";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM = "whatsapp:+14155238886";

const QUESTIONS = [
  {
    key: "medication",
    ask: (caregiver: string, patient: string) =>
      `Hi ${caregiver} 👋\nLet's check on ${patient} today.\n\n1️⃣ Has ${patient} taken their medication?\nReply *YES* or *NO*`,
    yes: "Great 👍 Thanks for confirming.",
    no: "Noted 📝 Please make sure to give the medication as soon as possible.",
  },
  {
    key: "meals",
    ask: (_: string, patient: string) =>
      `2️⃣ Has ${patient} eaten their meals today?\nReply *YES* or *NO*`,
    yes: "Wonderful 😊 Good nutrition matters a lot.",
    no: "Okay, try to encourage some food or fluids when you can.",
  },
  {
    key: "concerns",
    ask: (_: string, patient: string) =>
      `3️⃣ Any concerns about ${patient} today?\nReply *YES* or *NO*`,
    yes: "I hear you 💙 Feel free to describe what's happening and I'll help assess.",
    no: null,
  },
];

export function buildOpeningMessage(caregiverName: string, patientName: string): string {
  return QUESTIONS[0].ask(caregiverName, patientName);
}

export function buildNextQuestion(step: number, caregiverName: string, patientName: string): string {
  return QUESTIONS[step].ask(caregiverName, patientName);
}

export type FeedbackResult = {
  message: string;
  triggerAI?: boolean;
  showSummary?: boolean;
};

export function buildSummary(caregiverName: string, patientName: string, data: Record<string, string>): string {
  const med = data.medication === "YES" ? "Taken ✅" : "Missed ⚠️";
  const meals = data.meals === "YES" ? "Taken ✅" : "Skipped ⚠️";
  const concerns = data.concerns === "YES" ? "Flagged 🔴" : "None 👍";

  const hasIssue = data.medication === "NO" || data.meals === "NO";
  const status = hasIssue ? "Needs attention ⚠️" : "Stable 💚";

  return `✅ Daily Summary for ${patientName}:\n\n• Medication: ${med}\n• Meals: ${meals}\n• Concerns: ${concerns}\n\nOverall status: ${status}\n\nI'll continue monitoring, ${caregiverName}. Let me know anytime if something changes 💙`;
}

export function buildFeedback(step: number, isYes: boolean, caregiverName: string, patientName: string): FeedbackResult {
  const isLast = step === QUESTIONS.length - 1;

  // Medication NO
  if (step === 0 && !isYes) {
    const nextQ = QUESTIONS[1].ask(caregiverName, patientName);
    return {
      message: `⚠️ It looks like ${patientName} may have missed medication.\n\nRecommended:\n• Give medication if safe to do so\n• If unsure, check prescription or contact doctor\n\nI can remind you again in 1 hour if needed.\n\n${nextQ}`,
    };
  }

  // Meals NO
  if (step === 1 && !isYes) {
    const nextQ = QUESTIONS[2].ask(caregiverName, patientName);
    return {
      message: `⚠️ ${patientName} hasn't eaten today.\n\nSuggested:\n• Offer light foods (soup, porridge)\n• Encourage small frequent meals\n\nMonitor closely if this continues.\n\n${nextQ}`,
    };
  }

  // Concerns YES → trigger AI
  if (isLast && isYes) {
    return {
      message: `I hear you 💙 What concerns are you noticing about ${patientName}?\n\nDescribe what's happening and I'll help you assess.`,
      triggerAI: true,
    };
  }

  // Concerns NO → return signal to show summary
  if (isLast && !isYes) {
    return { message: "", showSummary: true };
  }

  // Default: positive feedback + next question
  const feedback = isYes ? QUESTIONS[step].yes : QUESTIONS[step].no ?? "";
  const nextQ = QUESTIONS[step + 1].ask(caregiverName, patientName);
  return { message: `${feedback}\n\n${nextQ}` };
}

export const CHECKIN_TOTAL = QUESTIONS.length;

export async function sendCheckinQuestion(phone: string, caregiverName: string, patientName: string, questionIndex: number) {
  await client.messages.create({
    from: FROM,
    to: phone,
    body: QUESTIONS[questionIndex].ask(caregiverName, patientName),
  });
}

export async function startCheckin(phone: string, caregiverName: string, patientName: string) {
  await db.collection("users").doc(phone).update({
    checkinActive: true,
    checkinStep: 0,
    checkinDate: new Date().toISOString().split("T")[0],
  });
  await sendCheckinQuestion(phone, caregiverName, patientName, 0);
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
      await startCheckin(user.phone, user.caregiverName ?? "there", user.patientName ?? "your patient");
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
