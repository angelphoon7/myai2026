"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FROM = void 0;
exports.sendWhatsApp = sendWhatsApp;
exports.sendWhatsAppLong = sendWhatsAppLong;
const twilio_1 = __importDefault(require("twilio"));
const client = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
exports.FROM = "whatsapp:+14155238886";
async function sendWhatsApp(to, body) {
    const toFormatted = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
    await client.messages.create({ from: exports.FROM, to: toFormatted, body });
}
// Splits messages exceeding Twilio's 1600-char limit on newline boundaries
async function sendWhatsAppLong(to, body) {
    const MAX = 1500;
    if (body.length <= MAX)
        return sendWhatsApp(to, body);
    const chunks = [];
    const lines = body.split('\n');
    let current = '';
    for (const line of lines) {
        const candidate = current ? `${current}\n${line}` : line;
        if (candidate.length > MAX) {
            if (current)
                chunks.push(current);
            current = line;
        }
        else {
            current = candidate;
        }
    }
    if (current)
        chunks.push(current);
    for (let i = 0; i < chunks.length; i++) {
        await sendWhatsApp(to, chunks[i]);
        if (i < chunks.length - 1)
            await new Promise(r => setTimeout(r, 600));
    }
}
