import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function getAIResponse(message: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `You are KAI, a caregiver support assistant. Be concise.

Respond in this exact format (2 lines max per field):

Assessment: [1 sentence]
Urgency: [Low / Medium / High / Emergency]
Action: [1 clear next step]

Message: ${message}`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
