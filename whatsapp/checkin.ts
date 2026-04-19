import cron from "node-cron";
import twilio from "twilio";
import { db } from "./firebase";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM = "whatsapp:+14155238886"; // Twilio sandbox number

export const CHECKIN_QUESTIONS = [
  "Has {patient} taken their medication? Reply *YES* or *NO*",
  "Has {patient} eaten their meals today? Reply *YES* or *NO*",
  "Any concerns about {patient} today? Reply *YES* or *NO*",
];

export async function sendCheckinQuestion(phone: string, patientName: string, questionIndex: number) {
  const question = CHECKIN_QUESTIONS[questionIndex].replace("{patient}", patientName);
  await client.messages.create({
    from: FROM,
    to: phone,
    body: `KAI Check-in (${questionIndex + 1}/${CHECKIN_QUESTIONS.length})\n\n${question}`,
  });
}

export async function startCheckin(phone: string, patientName: string) {
  await db.collection("users").doc(phone).update({
    checkinActive: true,
    checkinStep: 0,
    checkinDate: new Date().toISOString().split("T")[0],
  });
  await sendCheckinQuestion(phone, patientName, 0);
}

// Sets state only — caller sends the first question via TwiML (avoids duplicate)
export async function initCheckinState(phone: string) {
  await db.collection("users").doc(phone).update({
    checkinActive: true,
    checkinStep: 0,
    checkinDate: new Date().toISOString().split("T")[0],
  });
}

export function scheduleCheckins() {
  // Run every minute to check who needs a check-in
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const currentTime = `${now.getHours() % 12 || 12}${now.getMinutes() === 0 ? "am" : ""}`;
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
      await startCheckin(user.phone, user.patientName ?? "your patient");
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
