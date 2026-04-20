import twilio from "twilio";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
export const FROM = "whatsapp:+14155238886";

export async function sendWhatsApp(to: string, body: string): Promise<void> {
  const toFormatted = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  await client.messages.create({ from: FROM, to: toFormatted, body });
}
