import { z } from 'genkit';
import { ai } from './genkit';

export interface TriageContext {
  caregiverName: string;
  patientName: string;
  patientAge?: string;
  condition?: string;
  medications?: string;
  missedMedDays?: number;
  skippedMealDays?: number;
  language?: 'en' | 'ms';
}

const TriageInput = z.object({
  concern: z.string(),
  caregiverName: z.string(),
  patientName: z.string(),
  patientAge: z.string().optional(),
  condition: z.string().optional(),
  medications: z.string().optional(),
  missedMedDays: z.number().optional(),
  skippedMealDays: z.number().optional(),
  language: z.enum(['en', 'ms']).optional(),
});

const triageFlow = ai.defineFlow(
  { name: 'triage', inputSchema: TriageInput, outputSchema: z.string() },
  async (input) => {
    const patternNotes: string[] = [];
    if ((input.missedMedDays ?? 0) >= 1) patternNotes.push(`missed medication ${input.missedMedDays}x this week`);
    if ((input.skippedMealDays ?? 0) >= 1) patternNotes.push(`skipped meals ${input.skippedMealDays}x this week`);
    const patternLine = patternNotes.length > 0 ? `Recent pattern: ${patternNotes.join(', ')}.` : '';
    const langLine = input.language === 'ms' ? 'Respond entirely in Bahasa Malaysia.' : 'Respond in English.';

    const prompt = `You are KAI, a medical triage assistant helping home caregivers in Malaysia decide whether to manage at home, visit a clinic, or go to A&E. Malaysia's public hospitals are overcrowded — only escalate to A&E when truly necessary. ${langLine}

Caregiver: ${input.caregiverName}
Patient: ${input.patientName}, Age: ${input.patientAge ?? 'elderly'}
Condition: ${input.condition ?? 'not specified'}
Medications: ${input.medications ?? 'not specified'}
${patternLine}

Caregiver concern: ${input.concern}

Respond in EXACTLY this format. Choose ONE triage level. Do not add extra sections.

🩺 Triage: [HOME CARE / CLINIC TODAY / GO TO A&E NOW]

[1 warm sentence addressing ${input.caregiverName} about what may be happening]

--- If HOME CARE ---
✅ What to do now:
• [specific action 1 — reference actual medication or condition if relevant]
• [specific action 2]
• [specific action 3]
⏰ Escalate to clinic if: [2 specific warning signs to watch for]

--- If CLINIC TODAY ---
🏥 This needs a doctor but is not an emergency. Book a clinic visit today.
• Tell the doctor: [key symptoms, duration, and ${input.patientName}'s condition]
• While waiting: [1-2 home actions]
⚠️ Go to A&E instead if: [2 specific red flags]

--- If GO TO A&E NOW ---
🚨 Go to A&E immediately — do not wait.
📋 Show this to the doctor:
Patient: ${input.patientName}, ${input.patientAge ?? 'elderly'} — ${input.condition ?? 'chronic condition'} — on ${input.medications ?? 'regular medications'}
Concern: [summarise in 1 line]
🚗 While travelling: [1 immediate safety action for caregiver]`;

    const response = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt,
    });

    return response.text ?? '';
  }
);

export async function getTriageResponse(concern: string, ctx: TriageContext): Promise<string> {
  return triageFlow({ concern, ...ctx });
}
