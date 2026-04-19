import { z } from 'genkit';
import { ai } from './genkit';

const AIInput = z.object({
  message: z.string(),
  caregiverName: z.string().optional(),
  patientName: z.string().optional(),
  condition: z.string().optional(),
  medications: z.string().optional(),
  language: z.enum(['en', 'ms']).optional(),
});

const aiResponseFlow = ai.defineFlow(
  { name: 'aiResponse', inputSchema: AIInput, outputSchema: z.string() },
  async (input) => {
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

    const response = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt,
    });

    return response.text ?? '';
  }
);

export async function getAIResponse(
  message: string,
  context?: { caregiverName?: string; patientName?: string; condition?: string; medications?: string; language?: 'en' | 'ms' }
): Promise<string> {
  return aiResponseFlow({ message, ...context });
}
