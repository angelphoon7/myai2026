type Lang = "en" | "ms";

export function shouldAskWellness(lastWellnessCheck?: string): boolean {
  if (!lastWellnessCheck) return true;
  const daysDiff = (Date.now() - new Date(lastWellnessCheck).getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff >= 3;
}

export function buildWellnessCheck(caregiverName: string, lang: Lang = "en"): string {
  if (lang === "ms") {
    return `\n\n💙 ${caregiverName}, macam mana keadaan ANDA hari ini?\n\n1. Saya okay\n2. Sedikit penat\n3. Sangat tertekan`;
  }
  return `\n\n💙 ${caregiverName}, how are YOU holding up today?\n\n1. I'm okay\n2. A bit tired\n3. Really struggling`;
}

export function buildWellnessResponse(choice: string, caregiverName: string, lang: Lang = "en"): string {
  if (lang === "ms") {
    const responses: Record<string, string> = {
      "1": `Syukurlah, ${caregiverName} 😊 Teruskan — anda melakukan sesuatu yang luar biasa.`,
      "2": `Saya faham, ${caregiverName} 💙 Menjaga orang tersayang memang berat. Cuba ambil rehat sebentar hari ini — anda penting juga.`,
      "3": `${caregiverName}, terima kasih kerana jujur 💙 Ini tidak mudah. Cuba minta bantuan ahli keluarga lain hari ini — anda perlu rehat untuk terus memberi penjagaan yang baik.`,
    };
    return responses[choice] ?? `Sila balas 1, 2, atau 3.`;
  }
  const responses: Record<string, string> = {
    "1": `Glad to hear it, ${caregiverName} 😊 Keep going — you're doing something remarkable.`,
    "2": `I understand, ${caregiverName} 💙 Caregiving is hard. Try to take a small break today — you matter too.`,
    "3": `${caregiverName}, thank you for being honest 💙 This is not easy. Consider asking another family member to help today — you need rest to keep caring well.`,
  };
  return responses[choice] ?? `Please reply 1, 2, or 3.`;
}
