import { db } from "./firebase";

type Lang = "en" | "ms";

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
    if (data.medication === "NO" || data.medication === "TIDAK") counts.missedMedication++;
    if (data.meals === "NO" || data.meals === "TIDAK") counts.skippedMeals++;
    if (data.concerns === "YES" || data.concerns === "YA") counts.raisedConcerns++;
  }

  return counts;
}

export async function saveSymptomNote(phone: string, text: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  await db.collection("checkins").doc(`${phone}_${today}`).set(
    { concernText: text.substring(0, 500) },
    { merge: true }
  );
}

export async function getRecentSymptomNotes(phone: string): Promise<string[]> {
  const notes: string[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const doc = await db.collection("checkins").doc(`${phone}_${dateStr}`).get();
    if (!doc.exists) continue;
    const text = doc.data()?.concernText;
    if (text) notes.push(`[${dateStr}] ${text}`);
  }
  return notes;
}

export async function getVitalReadings(phone: string): Promise<{ date: string; vital: string }[]> {
  const today = new Date();
  const readings: { date: string; vital: string }[] = [];

  for (let i = 0; i <= 6; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const doc = await db.collection("checkins").doc(`${phone}_${dateStr}`).get();
    if (!doc.exists) continue;
    const data = doc.data()!;
    if (data.vital && !["skip", "langkau"].includes(data.vital.toLowerCase())) {
      readings.push({ date: dateStr, vital: data.vital });
    }
  }

  return readings;
}

function parseVitalValue(vital: string): number {
  if (vital.includes("/")) return parseInt(vital.split("/")[0]) || 0;
  return parseFloat(vital) || 0;
}

export function analyzeVitalTrend(
  readings: { date: string; vital: string }[],
  condition: string,
  patientName: string,
  lang: Lang = "en"
): string {
  if (readings.length < 1) return "";
  const cond = condition.toLowerCase();
  const values = readings.slice(0, 3).map(r => parseVitalValue(r.vital));
  const latest = values[0];
  const consecutiveRise = values.length >= 3 && values[0] > values[1] && values[1] > values[2];

  if (cond.includes("diabetes")) {
    if (latest < 4) return lang === "ms"
      ? `🚨 Gula darah ${patientName} SANGAT RENDAH (${readings[0].vital} mmol/L) — tindakan segera diperlukan!`
      : `🚨 ${patientName}'s blood sugar is CRITICALLY LOW (${readings[0].vital} mmol/L) — immediate action needed!`;
    if (latest > 10) return lang === "ms"
      ? `⚠️ Gula darah ${patientName} tinggi (${readings[0].vital} mmol/L) — semak diet dan ubat.`
      : `⚠️ ${patientName}'s blood sugar is high (${readings[0].vital} mmol/L) — review diet and medication.`;
    if (consecutiveRise) return lang === "ms"
      ? `📈 Gula darah ${patientName} meningkat 3 hari berturut-turut — pertimbangkan lawatan ke klinik.`
      : `📈 ${patientName}'s blood sugar has risen for 3 consecutive days — consider a clinic visit.`;
  }

  if (cond.includes("hypertension") || cond.includes("darah tinggi")) {
    if (latest > 160) return lang === "ms"
      ? `🚨 Tekanan darah ${patientName} SANGAT TINGGI (${readings[0].vital}) — ke klinik hari ini.`
      : `🚨 ${patientName}'s blood pressure is CRITICALLY HIGH (${readings[0].vital}) — visit a clinic today.`;
    if (latest > 140) return lang === "ms"
      ? `⚠️ Tekanan darah ${patientName} tinggi (${readings[0].vital}) — pastikan ubat diambil.`
      : `⚠️ ${patientName}'s blood pressure is elevated (${readings[0].vital}) — ensure medication is taken.`;
    if (consecutiveRise) return lang === "ms"
      ? `📈 Tekanan darah ${patientName} meningkat 3 hari berturut — semak pengambilan ubat.`
      : `📈 ${patientName}'s blood pressure has risen for 3 consecutive days — check medication compliance.`;
  }

  if (cond.includes("stroke") || cond.includes("strok") || cond.includes("dementia")) {
    if (latest <= 2) return lang === "ms"
      ? `⚠️ Skor keadaan ${patientName} rendah (${latest}/5) — ini memerlukan perhatian.`
      : `⚠️ ${patientName}'s condition score is low (${latest}/5) — this needs attention.`;
  }

  return "";
}

export function buildMemoryObservation(patientName: string, patterns: PatternSummary, lang: Lang = "en", vitalAlert = ""): string {
  const notes: string[] = [];

  if (lang === "ms") {
    if (patterns.missedMedication >= 2) notes.push(`💊 ${patientName} terlepas ubat ${patterns.missedMedication}x minggu ini`);
    if (patterns.skippedMeals >= 2) notes.push(`🍽️ ${patientName} langkau makan ${patterns.skippedMeals}x minggu ini`);
    if (patterns.raisedConcerns >= 2) notes.push(`⚠️ Anda meluahkan kebimbangan ${patterns.raisedConcerns}x minggu ini`);
    if (vitalAlert) notes.push(vitalAlert);
    if (notes.length === 0) return "";
    return `Saya perasan:\n${notes.join("\n")}\n\nMari semak hari ini 👇`;
  }

  if (patterns.missedMedication >= 2) notes.push(`💊 ${patientName} missed medication ${patterns.missedMedication}x this week`);
  if (patterns.skippedMeals >= 2) notes.push(`🍽️ ${patientName} skipped meals ${patterns.skippedMeals}x this week`);
  if (patterns.raisedConcerns >= 2) notes.push(`⚠️ You raised concerns ${patterns.raisedConcerns}x this week`);
  if (vitalAlert) notes.push(vitalAlert);
  if (notes.length === 0) return "";
  return `I noticed:\n${notes.join("\n")}\n\nLet's check in today 👇`;
}

export function buildEscalationAlert(patientName: string, patterns: PatternSummary, lang: Lang = "en"): string {
  const risks: string[] = [];

  if (lang === "ms") {
    if (patterns.missedMedication >= 2) risks.push(`terlepas ubat ${patterns.missedMedication} kali baru-baru ini`);
    if (patterns.skippedMeals >= 2) risks.push(`langkau makan ${patterns.skippedMeals} kali baru-baru ini`);
    if (risks.length === 0) return "";
    return `\n\n⚠️ KAI Insight:\n${patientName} telah ${risks.join(" dan ")}.\n\nIni mungkin meningkatkan risiko kesihatan.\n\nAdakah anda mahu saya:\n1️⃣ Tetapkan peringatan ubat\n2️⃣ Maklumkan ahli keluarga\n3️⃣ Tempah teleconsult\n\nBalas 1, 2, atau 3`;
  }

  if (patterns.missedMedication >= 2) risks.push(`missed medication ${patterns.missedMedication} times recently`);
  if (patterns.skippedMeals >= 2) risks.push(`skipped meals ${patterns.skippedMeals} times recently`);
  if (risks.length === 0) return "";
  return `\n\n⚠️ KAI Insight:\n${patientName} has ${risks.join(" and ")}.\n\nThis may increase health risk.\n\nWould you like me to:\n1️⃣ Set a medication reminder\n2️⃣ Notify a family member\n3️⃣ Book a teleconsult\n\nReply 1, 2, or 3`;
}

export function shouldEscalate(patterns: PatternSummary): boolean {
  return patterns.missedMedication >= 2 || patterns.skippedMeals >= 2;
}

export function shouldWarnBurnout(patterns: PatternSummary): boolean {
  return patterns.raisedConcerns >= 3;
}

export function buildWeeklySummaryMessage(
  caregiverName: string,
  patientName: string,
  patterns: PatternSummary,
  lang: Lang = "en"
): string {
  const medScore = patterns.missedMedication === 0 ? 40 : patterns.missedMedication <= 2 ? 20 : 0;
  const mealScore = patterns.skippedMeals === 0 ? 30 : patterns.skippedMeals <= 2 ? 15 : 0;
  const concernScore = patterns.raisedConcerns === 0 ? 30 : patterns.raisedConcerns <= 1 ? 20 : 10;
  const score = medScore + mealScore + concernScore;

  if (lang === "ms") {
    return `📊 Laporan Mingguan KAI — ${patientName}\n\n` +
      `• Ubat: ${patterns.missedMedication === 0 ? "✅ Tiada terlepas" : `⚠️ Terlepas ${patterns.missedMedication}x`}\n` +
      `• Makan: ${patterns.skippedMeals === 0 ? "✅ Konsisten" : `⚠️ Langkau ${patterns.skippedMeals}x`}\n` +
      `• Kebimbangan dilaporkan: ${patterns.raisedConcerns}x\n\n` +
      `Skor Penjagaan Mingguan: ${score}/100\n\n` +
      `Dijaga oleh: ${caregiverName} 💙\n_Laporan automatik daripada KAI_`;
  }

  return `📊 KAI Weekly Report — ${patientName}\n\n` +
    `• Medication: ${patterns.missedMedication === 0 ? "✅ None missed" : `⚠️ Missed ${patterns.missedMedication}x`}\n` +
    `• Meals: ${patterns.skippedMeals === 0 ? "✅ Consistent" : `⚠️ Skipped ${patterns.skippedMeals}x`}\n` +
    `• Concerns reported: ${patterns.raisedConcerns}x\n\n` +
    `Weekly Care Score: ${score}/100\n\n` +
    `Cared for by: ${caregiverName} 💙\n_Automated report from KAI_`;
}
