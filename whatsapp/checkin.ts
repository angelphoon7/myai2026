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

export function buildFeedback(step: number, isYes: boolean, caregiverName: string, patientName: string): string {
  const q = QUESTIONS[step];
  const feedback = isYes ? q.yes : q.no;
  const isLast = step === QUESTIONS.length - 1;

  if (isLast) {
    const closing = isYes
      ? `${feedback}\n\nPlease share what's on your mind and I'll help you assess the situation.`
      : `All good! You're doing an amazing job, ${caregiverName} 💙\n${patientName} is lucky to have you.\n\nCheck-in complete for today ✅`;
    return closing;
  }

  const nextQ = QUESTIONS[step + 1].ask(caregiverName, patientName);
  return `${feedback}\n\n${nextQ}`;
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
