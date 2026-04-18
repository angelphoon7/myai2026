import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  vertexai: true,
  apiKey: process.env.GOOGLE_CLOUD_API_KEY!,
});

export async function getAIResponse(message: string): Promise<string> {
  const prompt = `You are KAI, a caregiver support assistant. Be concise.

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
