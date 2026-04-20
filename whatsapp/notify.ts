import twilio from "twilio";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
export const FROM = "whatsapp:+14155238886";

export async function sendWhatsApp(to: string, body: string): Promise<void> {
  const toFormatted = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  await client.messages.create({ from: FROM, to: toFormatted, body });
}

// Splits messages exceeding Twilio's 1600-char limit on newline boundaries
export async function sendWhatsAppLong(to: string, body: string): Promise<void> {
  const MAX = 1500;
  if (body.length <= MAX) return sendWhatsApp(to, body);

  const chunks: string[] = [];
  const lines = body.split('\n');
  let current = '';

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > MAX) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  for (let i = 0; i < chunks.length; i++) {
    await sendWhatsApp(to, chunks[i]);
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 600));
  }
}
