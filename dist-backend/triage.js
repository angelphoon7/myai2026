"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTriageResponse = getTriageResponse;
const genkit_1 = require("genkit");
const genkit_2 = require("./genkit");
const TriageInput = genkit_1.z.object({
    concern: genkit_1.z.string(),
    caregiverName: genkit_1.z.string(),
    patientName: genkit_1.z.string(),
    patientAge: genkit_1.z.string().optional(),
    condition: genkit_1.z.string().optional(),
    medications: genkit_1.z.string().optional(),
    missedMedDays: genkit_1.z.number().optional(),
    skippedMealDays: genkit_1.z.number().optional(),
    language: genkit_1.z.enum(['en', 'ms']).optional(),
});
const triageFlow = genkit_2.ai.defineFlow({ name: 'triage', inputSchema: TriageInput, outputSchema: genkit_1.z.string() }, async (input) => {
    const patternNotes = [];
    if ((input.missedMedDays ?? 0) >= 1)
        patternNotes.push(`missed medication ${input.missedMedDays}x this week`);
    if ((input.skippedMealDays ?? 0) >= 1)
        patternNotes.push(`skipped meals ${input.skippedMealDays}x this week`);
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
    const response = await genkit_2.ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt,
    });
    return response.text ?? '';
});
async function getTriageResponse(concern, ctx) {
    return triageFlow({ concern, ...ctx });
}
