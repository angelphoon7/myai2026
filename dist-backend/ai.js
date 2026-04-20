"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAIResponse = getAIResponse;
const genkit_1 = require("genkit");
const genkit_2 = require("./genkit");
const AIInput = genkit_1.z.object({
    message: genkit_1.z.string(),
    caregiverName: genkit_1.z.string().optional(),
    patientName: genkit_1.z.string().optional(),
    condition: genkit_1.z.string().optional(),
    medications: genkit_1.z.string().optional(),
    language: genkit_1.z.enum(['en', 'ms']).optional(),
});
const aiResponseFlow = genkit_2.ai.defineFlow({ name: 'aiResponse', inputSchema: AIInput, outputSchema: genkit_1.z.string() }, async (input) => {
    const caregiver = input.caregiverName ?? '';
    const patient = input.patientName ?? 'the patient';
    const condition = input.condition ? `Condition: ${input.condition}.` : '';
    const medications = input.medications ? `Current medications: ${input.medications}.` : '';
    const addressLine = caregiver ? `Address the caregiver as ${caregiver}. The patient's name is ${patient}.` : '';
    const langLine = input.language === 'ms' ? 'Respond entirely in Bahasa Malaysia.' : 'Respond in English.';
    const prompt = `You are KAI, a warm and intelligent caregiver support assistant. ${addressLine} ${condition} ${medications} ${langLine}

Respond in this exact format:

Assessment: [1 warm, human sentence addressing the caregiver by name]
Urgency: [Low / Medium / High / Emergency]
Steps:
• [specific action 1]
• [specific action 2]
• [specific action 3]

Keep steps practical and specific — not vague. Example: "Give Metformin 500mg with food" not "give medication".

Message: ${input.message}`;
    const response = await genkit_2.ai.generate({
        model: 'googleai/gemini-2.5-flash',
        prompt,
    });
    return response.text ?? '';
});
async function getAIResponse(message, context) {
    return aiResponseFlow({ message, ...context });
}
