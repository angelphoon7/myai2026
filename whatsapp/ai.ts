import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  vertexai: true,
  apiKey: process.env.GOOGLE_CLOUD_API_KEY!,
});

export async function getAIResponse(
  message: string,
  context?: { caregiverName?: string; patientName?: string; condition?: string; medications?: string; language?: "en" | "ms" }
): Promise<string> {
  const caregiver = context?.caregiverName ?? "";
  const patient = context?.patientName ?? "the patient";
  const condition = context?.condition ? `Condition: ${context.condition}.` : "";
  const medications = context?.medications ? `Current medications: ${context.medications}.` : "";
  const addressLine = caregiver ? `Address the caregiver as ${caregiver}. The patient's name is ${patient}.` : "";
  const langLine = context?.language === "ms" ? "Respond entirely in Bahasa Malaysia." : "Respond in English.";

  const prompt = `You are KAI, a warm and intelligent caregiver support assistant. ${addressLine} ${condition} ${medications} ${langLine}

Respond in this exact format:

Assessment: [1 warm, human sentence addressing the caregiver by name]
Urgency: [Low / Medium / High / Emergency]
Steps:
• [specific action 1]
• [specific action 2]
• [specific action 3]

Keep steps practical and specific — not vague. Example: "Give Metformin 500mg with food" not "give medication".

Message: ${message}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
  });

  return response.text ?? '';
}
