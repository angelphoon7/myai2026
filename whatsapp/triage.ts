import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  vertexai: true,
  apiKey: process.env.GOOGLE_CLOUD_API_KEY!,
});

export interface TriageContext {
  caregiverName: string;
  patientName: string;
  patientAge?: string;
  condition?: string;
  medications?: string;
  missedMedDays?: number;
  skippedMealDays?: number;
}

export async function getTriageResponse(concern: string, ctx: TriageContext): Promise<string> {
  const patternNotes: string[] = [];
  if ((ctx.missedMedDays ?? 0) >= 1) patternNotes.push(`missed medication ${ctx.missedMedDays}x this week`);
  if ((ctx.skippedMealDays ?? 0) >= 1) patternNotes.push(`skipped meals ${ctx.skippedMealDays}x this week`);
  const patternLine = patternNotes.length > 0 ? `Recent pattern: ${patternNotes.join(", ")}.` : "";

  const prompt = `You are KAI, a medical triage assistant helping home caregivers in Malaysia decide whether to manage at home, visit a clinic, or go to A&E. Malaysia's public hospitals are overcrowded — only escalate to A&E when truly necessary.

Caregiver: ${ctx.caregiverName}
Patient: ${ctx.patientName}, Age: ${ctx.patientAge ?? "elderly"}
Condition: ${ctx.condition ?? "not specified"}
Medications: ${ctx.medications ?? "not specified"}
${patternLine}

Caregiver concern: ${concern}

Respond in EXACTLY this format. Choose ONE triage level. Do not add extra sections.

🩺 Triage: [HOME CARE / CLINIC TODAY / GO TO A&E NOW]

[1 warm sentence addressing ${ctx.caregiverName} about what may be happening]

--- If HOME CARE ---
✅ What to do now:
• [specific action 1 — reference actual medication or condition if relevant]
• [specific action 2]
• [specific action 3]
⏰ Escalate to clinic if: [2 specific warning signs to watch for]

--- If CLINIC TODAY ---
🏥 This needs a doctor but is not an emergency. Book a clinic visit today.
• Tell the doctor: [key symptoms, duration, and ${ctx.patientName}'s condition]
• While waiting: [1-2 home actions]
⚠️ Go to A&E instead if: [2 specific red flags]

--- If GO TO A&E NOW ---
🚨 Go to A&E immediately — do not wait.
📋 Show this to the doctor:
Patient: ${ctx.patientName}, ${ctx.patientAge ?? "elderly"} — ${ctx.condition ?? "chronic condition"} — on ${ctx.medications ?? "regular medications"}
Concern: [summarise in 1 line]
🚗 While travelling: [1 immediate safety action for caregiver]`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
  });

  return response.text ?? '';
}
