"use client";

import { useState } from "react";
import IPhone13Frame from "@/components/iPhone13Frame";
import Grainient from "./Grainient";

type Lang = "en" | "ms";

interface FormData {
  phone: string;
  language: Lang;
  caregiverName: string;
  relationship: string;
  patientName: string;
  patientAge: string;
  mainCondition: string;
  medications: string;
  checkInTime: string;
  familyName: string;
  familyPhone: string;
}

const TOTAL_STEPS = 9;

const T = {
  en: {
    back: "Back",
    next: "Next",
    skip: "Skip",
    finish: "Finish Setup",
    step: (n: number) => `Step ${n} of ${TOTAL_STEPS}`,
    s1: { title: "Choose Language", subtitle: "Select your preferred language" },
    s2: { title: "Your WhatsApp Number", subtitle: "We'll link your account to this number", label: "WhatsApp number", placeholder: "+60123456789" },
    s3: { title: "Your Name", subtitle: "What should KAI call you?", label: "Your name", placeholder: "e.g. Ahmad" },
    s4: { title: "Your Relationship", subtitle: "Who are you caring for?" },
    s5: { title: "Patient Details", subtitle: "Tell us about the person you're caring for", nameLbl: "Patient's name", namePH: "e.g. Mak Cik Rohani", ageLbl: "Age", agePH: "e.g. 72" },
    s6: { title: "Main Condition", subtitle: "What is the primary health concern?" },
    s7: { title: "Current Medications", subtitle: "List medications so KAI can flag issues", label: "Medications", placeholder: "e.g. Metformin 500mg, Amlodipine 5mg\n\nLeave blank if none." },
    s8: { title: "Daily Check-in Time", subtitle: "When should KAI check in each day?", label: "Check-in time(s)", placeholder: "e.g. 9am and 6pm" },
    s9: { title: "Emergency Contact", subtitle: "Optional — family member to alert in emergencies", nameLbl: "Their name", namePH: "e.g. Ahmad Jr.", phoneLbl: "Their WhatsApp number", phonePH: "+60123456789" },
    s10: { title: "Connect WhatsApp", subtitle: "One last step — activate KAI on WhatsApp" },
    relationships: ["Parent", "Spouse", "Grandparent", "Other"],
    conditions: ["Diabetes", "Hypertension", "Stroke Recovery", "Dementia", "Other"],
    connectStep1: "1. Save this number",
    connectStep2: "2. Send this message",
    connectStep3: "3. Start chatting",
    openWhatsApp: "Open WhatsApp",
    copied: "Copied!",
    copy: "Copy",
    allSet: "You're all set! KAI will greet you on WhatsApp.",
  },
  ms: {
    back: "Kembali",
    next: "Seterusnya",
    skip: "Langkau",
    finish: "Selesai Persediaan",
    step: (n: number) => `Langkah ${n} daripada ${TOTAL_STEPS}`,
    s1: { title: "Pilih Bahasa", subtitle: "Pilih bahasa pilihan anda" },
    s2: { title: "Nombor WhatsApp Anda", subtitle: "Kami akan menghubungkan akaun anda ke nombor ini", label: "Nombor WhatsApp", placeholder: "+60123456789" },
    s3: { title: "Nama Anda", subtitle: "Apa nama anda?", label: "Nama anda", placeholder: "cth. Ahmad" },
    s4: { title: "Hubungan Anda", subtitle: "Siapa yang anda jaga?" },
    s5: { title: "Maklumat Pesakit", subtitle: "Ceritakan tentang orang yang anda jaga", nameLbl: "Nama pesakit", namePH: "cth. Mak Cik Rohani", ageLbl: "Umur", agePH: "cth. 72" },
    s6: { title: "Penyakit Utama", subtitle: "Apakah masalah kesihatan utama?" },
    s7: { title: "Ubat Semasa", subtitle: "Senaraikan ubat agar KAI boleh kenalpasti isu", label: "Ubat-ubatan", placeholder: "cth. Metformin 500mg, Amlodipine 5mg\n\nBiarkan kosong jika tiada." },
    s8: { title: "Masa Semakan Harian", subtitle: "Bilakah KAI perlu semak setiap hari?", label: "Masa semakan", placeholder: "cth. 9am dan 6pm" },
    s9: { title: "Kenalan Kecemasan", subtitle: "Pilihan — ahli keluarga untuk dihubungi semasa kecemasan", nameLbl: "Nama mereka", namePH: "cth. Ahmad Jr.", phoneLbl: "Nombor WhatsApp mereka", phonePH: "+60123456789" },
    s10: { title: "Sambung WhatsApp", subtitle: "Satu langkah lagi — aktifkan KAI di WhatsApp" },
    relationships: ["Ibu/Bapa", "Pasangan", "Datuk/Nenek", "Lain-lain"],
    conditions: ["Diabetes", "Darah Tinggi", "Pemulihan Strok", "Dementia", "Lain-lain"],
    connectStep1: "1. Simpan nombor ini",
    connectStep2: "2. Hantar mesej ini",
    connectStep3: "3. Mula berbual",
    openWhatsApp: "Buka WhatsApp",
    copied: "Disalin!",
    copy: "Salin",
    allSet: "Anda sudah bersedia! KAI akan menyapa anda di WhatsApp.",
  },
};

const TWILIO_NUMBER = "+1 415 523 8886";
const JOIN_CODE = process.env.NEXT_PUBLIC_TWILIO_JOIN_CODE ?? "join <your-sandbox-word>";

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [lang, setLang] = useState<Lang>("en");
  const [copied, setCopied] = useState<"number" | "code" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState<FormData>({
    phone: "", language: "en", caregiverName: "", relationship: "",
    patientName: "", patientAge: "", mainCondition: "", medications: "",
    checkInTime: "", familyName: "", familyPhone: "",
  });

  const t = T[lang];
  const set = (key: keyof FormData, val: string) => setForm(f => ({ ...f, [key]: val }));

  const copyText = async (text: string, which: "number" | "code") => {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  };

  const canNext = () => {
    if (step === 2) return form.phone.trim().length > 6;
    if (step === 3) return form.caregiverName.trim().length > 0;
    if (step === 4) return form.relationship.length > 0;
    if (step === 5) return form.patientName.trim().length > 0 && form.patientAge.trim().length > 0;
    if (step === 6) return form.mainCondition.length > 0;
    if (step === 8) return form.checkInTime.trim().length > 0;
    return true;
  };

  const handleNext = async () => {
    if (step === 1) { setForm(f => ({ ...f, language: lang })); }
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return; }
    // Final step — save profile
    setSubmitting(true);
    try {
      await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, language: lang }),
      });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <IPhone13Frame>
      <div className="flex min-h-full flex-col relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Grainient
            color1="#ddcadc"
            color2="#857ca0"
            color3="#393140"
            timeSpeed={1.2}
            colorBalance={0}
            warpStrength={1}
            warpFrequency={5}
            warpSpeed={2}
            warpAmplitude={50}
            blendAngle={0}
            blendSoftness={0.05}
            rotationAmount={500}
            noiseScale={2}
            grainAmount={0.1}
            grainScale={2}
            grainAnimated={false}
            contrast={1.5}
            gamma={1}
            saturation={1}
            centerX={0}
            centerY={0}
            zoom={0.9}
          />
        </div>
        
        {/* Header */}
        <div className="relative z-10 px-5 pb-5 pt-10 text-white">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-teal-200">{t.step(step)}</span>
            <span className="text-xs font-medium text-teal-200">{Math.round(progress)}%</span>
          </div>
          <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-teal-900/40">
            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <h1 className="text-xl font-bold">
            {step === 1 && t.s1.title}
            {step === 2 && t.s2.title}
            {step === 3 && t.s3.title}
            {step === 4 && t.s4.title}
            {step === 5 && t.s5.title}
            {step === 6 && t.s6.title}
            {step === 7 && t.s7.title}
            {step === 8 && t.s8.title}
            {step === 9 && t.s9.title}
          </h1>
          <p className="mt-0.5 text-sm text-teal-100">
            {step === 1 && t.s1.subtitle}
            {step === 2 && t.s2.subtitle}
            {step === 3 && t.s3.subtitle}
            {step === 4 && t.s4.subtitle}
            {step === 5 && t.s5.subtitle}
            {step === 6 && t.s6.subtitle}
            {step === 7 && t.s7.subtitle}
            {step === 8 && t.s8.subtitle}
            {step === 9 && t.s9.subtitle}
          </p>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col px-5 py-6 relative z-10">
          {/* Step 1 — Language */}
          {step === 1 && (
            <div className="space-y-3">
              {(["en", "ms"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all ${
                    lang === l
                      ? "border-teal-500 bg-teal-50"
                      : "border-gray-100 bg-gray-50 hover:border-gray-200"
                  }`}
                >
                  <span className="text-3xl">{l === "en" ? "🇬🇧" : "🇲🇾"}</span>
                  <div>
                    <p className={`font-semibold ${lang === l ? "text-teal-700" : "text-gray-800"}`}>
                      {l === "en" ? "English" : "Bahasa Malaysia"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {l === "en" ? "Respond in English" : "Balas dalam Bahasa Malaysia"}
                    </p>
                  </div>
                  {lang === l && (
                    <span className="ml-auto text-teal-500">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Step 2 — Phone */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-teal-50 p-4 text-sm text-teal-700">
                📱 This number will be used to connect your WhatsApp with KAI.
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">{t.s2.label}</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => set("phone", e.target.value)}
                  placeholder={t.s2.placeholder}
                  className="h-12 w-full rounded-xl border border-gray-200 px-4 text-base text-gray-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
              </label>
            </div>
          )}

          {/* Step 3 — Caregiver name */}
          {step === 3 && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">{t.s3.label}</span>
              <input
                type="text"
                value={form.caregiverName}
                onChange={e => set("caregiverName", e.target.value)}
                placeholder={t.s3.placeholder}
                className="h-12 w-full rounded-xl border border-gray-200 px-4 text-base text-gray-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                autoFocus
              />
            </label>
          )}

          {/* Step 4 — Relationship */}
          {step === 4 && (
            <div className="grid grid-cols-2 gap-3">
              {t.relationships.map((r) => (
                <button
                  key={r}
                  onClick={() => set("relationship", r)}
                  className={`rounded-2xl border-2 p-4 text-center transition-all ${
                    form.relationship === r
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200"
                  }`}
                >
                  <span className="mb-1 block text-2xl">
                    {["👨‍👩‍👦", "💑", "👴", "🧑‍🤝‍🧑"][t.relationships.indexOf(r)]}
                  </span>
                  <span className="text-sm font-medium">{r}</span>
                </button>
              ))}
            </div>
          )}

          {/* Step 5 — Patient details */}
          {step === 5 && (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">{t.s5.nameLbl}</span>
                <input
                  type="text"
                  value={form.patientName}
                  onChange={e => set("patientName", e.target.value)}
                  placeholder={t.s5.namePH}
                  className="h-12 w-full rounded-xl border border-gray-200 px-4 text-base text-gray-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">{t.s5.ageLbl}</span>
                <input
                  type="number"
                  value={form.patientAge}
                  onChange={e => set("patientAge", e.target.value)}
                  placeholder={t.s5.agePH}
                  min={1} max={120}
                  className="h-12 w-full rounded-xl border border-gray-200 px-4 text-base text-gray-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
              </label>
            </div>
          )}

          {/* Step 6 — Condition */}
          {step === 6 && (
            <div className="grid grid-cols-2 gap-3">
              {(["🩸", "❤️", "🧠", "💭", "🏥"] as const).map((icon, i) => {
                const c = t.conditions[i];
                return (
                  <button
                    key={c}
                    onClick={() => set("mainCondition", c)}
                    className={`rounded-2xl border-2 p-4 text-center transition-all ${
                      form.mainCondition === c
                        ? "border-teal-500 bg-teal-50 text-teal-700"
                        : "border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200"
                    } ${i === 4 ? "col-span-2" : ""}`}
                  >
                    <span className="mb-1 block text-2xl">{icon}</span>
                    <span className="text-sm font-medium">{c}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 7 — Medications */}
          {step === 7 && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">{t.s7.label}</span>
              <textarea
                value={form.medications}
                onChange={e => set("medications", e.target.value)}
                placeholder={t.s7.placeholder}
                rows={5}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              />
            </label>
          )}

          {/* Step 8 — Check-in time */}
          {step === 8 && (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">{t.s8.label}</span>
                <input
                  type="text"
                  value={form.checkInTime}
                  onChange={e => set("checkInTime", e.target.value)}
                  placeholder={t.s8.placeholder}
                  className="h-12 w-full rounded-xl border border-gray-200 px-4 text-base text-gray-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <div className="space-y-2">
                {["8am", "9am", "12pm", "6pm", "9pm"].map(t => (
                  <button
                    key={t}
                    onClick={() => set("checkInTime", `${t} and 6pm`)}
                    className="mr-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 9 — Emergency contact */}
          {step === 9 && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-700">
                ⚠️ KAI will alert this person if an emergency is detected.
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">{t.s9.nameLbl}</span>
                <input
                  type="text"
                  value={form.familyName}
                  onChange={e => set("familyName", e.target.value)}
                  placeholder={t.s9.namePH}
                  className="h-12 w-full rounded-xl border border-gray-200 px-4 text-base text-gray-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">{t.s9.phoneLbl}</span>
                <input
                  type="tel"
                  value={form.familyPhone}
                  onChange={e => set("familyPhone", e.target.value)}
                  placeholder={t.s9.phonePH}
                  className="h-12 w-full rounded-xl border border-gray-200 px-4 text-base text-gray-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
              </label>
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div className="border-t border-gray-100 px-5 pb-8 pt-4">
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex h-12 flex-1 items-center justify-center rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                {t.back}
              </button>
            )}
            {step === 9 && (
              <button
                onClick={handleNext}
                className="flex h-12 flex-1 items-center justify-center rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                {t.skip}
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canNext() || submitting}
              className="flex h-12 flex-[2] items-center justify-center rounded-xl bg-teal-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-40"
            >
              {submitting ? "..." : step === TOTAL_STEPS ? t.finish : t.next}
            </button>
          </div>
        </div>
      </div>

      {/* Completion overlay */}
      {done && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white px-6 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-teal-100 text-4xl">
            🎉
          </div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">{t.s10.title}</h2>
          <p className="mb-8 text-gray-500">{t.s10.subtitle}</p>

          <div className="w-full space-y-4 text-left">
            {/* Step 1 */}
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.connectStep1}</p>
              <div className="flex items-center justify-between">
                <span className="font-mono text-lg font-bold text-gray-800">{TWILIO_NUMBER}</span>
                <button
                  onClick={() => copyText(TWILIO_NUMBER, "number")}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-teal-600 shadow-sm border border-gray-200"
                >
                  {copied === "number" ? t.copied : t.copy}
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-2xl bg-gray-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t.connectStep2}</p>
              <div className="flex items-center justify-between">
                <span className="font-mono text-base font-bold text-gray-800">{JOIN_CODE}</span>
                <button
                  onClick={() => copyText(JOIN_CODE, "code")}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-teal-600 shadow-sm border border-gray-200"
                >
                  {copied === "code" ? t.copied : t.copy}
                </button>
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-2xl bg-teal-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-400">{t.connectStep3}</p>
              <p className="mb-3 text-sm text-teal-700">{t.allSet}</p>
              <a
                href={`https://wa.me/14155238886?text=${encodeURIComponent(JOIN_CODE)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-bold text-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                {t.openWhatsApp}
              </a>
            </div>
          </div>
        </div>
      )}
    </IPhone13Frame>
  );
}
