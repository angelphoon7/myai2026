import { db } from "./firebase";

interface PatternSummary {
  missedMedication: number;
  skippedMeals: number;
  raisedConcerns: number;
}

export async function getWeeklyPatterns(phone: string): Promise<PatternSummary> {
  const today = new Date();
  const counts = { missedMedication: 0, skippedMeals: 0, raisedConcerns: 0 };

  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const doc = await db.collection("checkins").doc(`${phone}_${dateStr}`).get();
    if (!doc.exists) continue;
    const data = doc.data()!;
    if (data.medication === "NO") counts.missedMedication++;
    if (data.meals === "NO") counts.skippedMeals++;
    if (data.concerns === "YES") counts.raisedConcerns++;
  }

  return counts;
}

export function buildMemoryObservation(patientName: string, patterns: PatternSummary): string {
  const notes: string[] = [];

  if (patterns.missedMedication >= 2)
    notes.push(`💊 ${patientName} missed medication ${patterns.missedMedication}x this week`);
  if (patterns.skippedMeals >= 2)
    notes.push(`🍽️ ${patientName} skipped meals ${patterns.skippedMeals}x this week`);
  if (patterns.raisedConcerns >= 2)
    notes.push(`⚠️ You raised concerns ${patterns.raisedConcerns}x this week`);

  if (notes.length === 0) return "";

  return `I noticed:\n${notes.join("\n")}\n\nLet's check in today 👇`;
}

export function buildEscalationAlert(patientName: string, patterns: PatternSummary): string {
  const risks: string[] = [];

  if (patterns.missedMedication >= 2)
    risks.push(`missed medication ${patterns.missedMedication} times recently`);
  if (patterns.skippedMeals >= 2)
    risks.push(`skipped meals ${patterns.skippedMeals} times recently`);

  if (risks.length === 0) return "";

  const riskText = risks.join(" and ");

  return `\n\n⚠️ KAI Insight:\n${patientName} has ${riskText}.\n\nThis may increase health risk.\n\nWould you like me to:\n1️⃣ Set a medication reminder\n2️⃣ Notify a family member\n3️⃣ Book a teleconsult\n\nReply 1, 2, or 3`;
}

export function shouldEscalate(patterns: PatternSummary): boolean {
  return patterns.missedMedication >= 2 || patterns.skippedMeals >= 2;
}
