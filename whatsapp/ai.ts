import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  vertexai: true,
  apiKey: process.env.GOOGLE_CLOUD_API_KEY!,
});

export async function getAIResponse(message: string, context?: { caregiverName?: string; patientName?: string; condition?: string }): Promise<string> {
  const caregiver = context?.caregiverName ?? "";
  const patient = context?.patientName ?? "the patient";
  const condition = context?.condition ? `The patient has: ${context.condition}.` : "";
  const addressLine = caregiver ? `Address the caregiver as ${caregiver}. The patient's name is ${patient}.` : "";

  const prompt = `You are KAI, a caregiver support assistant. Be concise and warm. ${addressLine} ${condition}

Respond in this exact format (2 lines max per field):

Assessment: [1 sentence]
Urgency: [Low / Medium / High / Emergency]
Action: [1 clear next step]

Message: ${message}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
  });

  return response.text ?? '';
}
