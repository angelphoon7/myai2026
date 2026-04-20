"use client";

import { useEffect, useState } from "react";
import IPhone13Frame from "@/components/iPhone13Frame";
import Galaxy from "./Galaxy";

interface CheckIn {
  date: string;
  medication?: string;
  meals?: string;
  concerns?: string;
  vital?: string;
  concernText?: string;
}

interface Profile {
  caregiverName?: string;
  patientName?: string;
  patientAge?: string;
  mainCondition?: string;
  medications?: string;
  relationship?: string;
  checkInTime?: string;
  familyName?: string;
  familyPhone?: string;
  language?: "en" | "ms";
  phone?: string;
}

function careScore(c: CheckIn): number {
  const medOk = c.medication === "YES" || c.medication === "YA";
  const mealOk = c.meals === "YES" || c.meals === "YA";
  const noConcern = c.concerns !== "YES" && c.concerns !== "YA";
  return (medOk ? 50 : 0) + (mealOk ? 15 : 0) + (noConcern ? 35 : 0);
}

function scoreColor(score: number) {
  if (score === 100) return "text-emerald-600 bg-emerald-50";
  if (score >= 80) return "text-yellow-600 bg-yellow-50";
  if (score >= 50) return "text-orange-600 bg-orange-50";
  return "text-red-600 bg-red-50";
}

function scoreLabel(score: number) {
  if (score === 100) return "All Good";
  if (score >= 80) return "At Risk";
  if (score >= 50) return "Attention";
  return "High Risk";
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function ReportPage() {
  const [phone, setPhone] = useState("");
  const [input, setInput] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("phone");
    if (p) { setPhone(p); setInput(p); }
  }, []);

  useEffect(() => {
    if (!phone) return;
    setLoading(true);
    setError("");
    fetch(`/api/report?phone=${encodeURIComponent(phone)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setProfile(d.profile);
        setCheckins(d.checkins);
      })
      .catch(() => setError("Failed to load report"))
      .finally(() => setLoading(false));
  }, [phone]);

  const last7 = checkins.slice(0, 7);
  const medicationCompliance = last7.length
    ? Math.round((last7.filter(c => c.medication === "YES" || c.medication === "YA").length / last7.length) * 100)
    : 0;
  const mealCompliance = last7.length
    ? Math.round((last7.filter(c => c.meals === "YES" || c.meals === "YA").length / last7.length) * 100)
    : 0;
  const concernCount = last7.filter(c => c.concerns === "YES" || c.concerns === "YA").length;
  const vitals = checkins.filter(c => c.vital && !["skip", "langkau"].includes(c.vital.toLowerCase())).slice(0, 7);
  const concernNotes = checkins.filter(c => c.concernText).slice(0, 5);
  const avgScore = last7.length
    ? Math.round(last7.reduce((s, c) => s + careScore(c), 0) / last7.length)
    : 0;

  return (
    <IPhone13Frame>
      <div className="flex min-h-full flex-col bg-slate-900 relative overflow-hidden text-white font-serif">
        {/* Galaxy Background */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Galaxy 
            density={0.8}
            glowIntensity={0.4}
            twinkleIntensity={0.5}
            speed={0.5}
          />
        </div>
        
        {/* Content Overlay */}
        <div className="relative z-10 flex flex-col flex-1">
          {/* Header - Only show when report is loaded or loading */}
          {(profile || loading) && (
            <div className="bg-slate-900/60 backdrop-blur-lg px-5 pb-4 pt-10 border-b border-slate-800">
              <div className="mb-1 flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-wide">KAI Health Report</h1>
              </div>
              <p className="text-xs text-gray-400 font-sans">30-day patient summary for clinical review</p>

              <div className="mt-4 flex gap-2">
                <input
                  type="tel"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="+60123456789"
                  className="h-10 flex-1 rounded-xl border border-slate-700 bg-slate-800/80 px-3 text-sm font-sans text-white placeholder-gray-500 outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all"
                  onKeyDown={e => e.key === "Enter" && setPhone(input.trim())}
                />
                <button
                  onClick={() => setPhone(input.trim())}
                  className="h-10 rounded-xl bg-yellow-400 hover:bg-yellow-500 px-5 text-sm font-sans font-semibold text-gray-900 shadow-sm transition-colors"
                >
                  Load
                </button>
              </div>
            </div>
          )}

        {loading && (
          <div className="flex flex-1 items-center justify-center z-10">
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-yellow-400" />
              <p className="text-sm font-sans text-gray-400">Loading report…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">⚠️ {error}</div>
        )}

        {!loading && profile && (
          <div className="flex flex-col gap-4 p-4 pb-8 overflow-y-auto z-10">

            {/* Patient profile card */}
            <div className="rounded-2xl bg-slate-800/60 backdrop-blur-md border border-slate-700 p-4 shadow-xl">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">{profile.patientName ?? "—"}</h2>
                  <p className="text-sm text-gray-500">
                    Age {profile.patientAge ?? "—"} · {profile.mainCondition ?? "—"}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${scoreColor(avgScore)}`}>
                  {avgScore}/100
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                <div className="rounded-lg bg-slate-900/50 p-2">
                  <p className="font-medium text-gray-400 uppercase tracking-wide mb-0.5">Caregiver</p>
                  <p className="font-semibold text-white">{profile.caregiverName ?? "—"}</p>
                </div>
                <div className="rounded-lg bg-slate-900/50 p-2">
                  <p className="font-medium text-gray-400 uppercase tracking-wide mb-0.5">Relationship</p>
                  <p className="font-semibold text-white">{profile.relationship ?? "—"}</p>
                </div>
                <div className="col-span-2 rounded-lg bg-slate-900/50 p-2">
                  <p className="font-medium text-gray-400 uppercase tracking-wide mb-0.5">Current Medications</p>
                  <p className="font-semibold text-white leading-relaxed">{profile.medications || "None recorded"}</p>
                </div>
                {profile.familyName && (
                  <div className="col-span-2 rounded-lg bg-amber-50 p-2">
                    <p className="font-medium text-amber-400 uppercase tracking-wide mb-0.5">Emergency Contact</p>
                    <p className="font-semibold text-amber-800">{profile.familyName} · {profile.familyPhone}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 7-day summary stats */}
            <div className="rounded-2xl bg-slate-800/60 backdrop-blur-md border border-slate-700 p-4 shadow-xl">
              <h3 className="mb-3 text-sm font-bold text-white">7-Day Summary</h3>
              <div className="grid grid-cols-3 gap-2">
                {/* Medication */}
                <div className="flex flex-col items-center rounded-xl bg-slate-900/50 p-3">
                  <span className="mb-1 text-xl">💊</span>
                  <span className={`text-lg font-bold ${medicationCompliance >= 80 ? "text-emerald-600" : medicationCompliance >= 50 ? "text-yellow-500" : "text-red-500"}`}>
                    {medicationCompliance}%
                  </span>
                  <span className="mt-0.5 text-center text-[10px] text-gray-400">Medication</span>
                </div>
                {/* Meals */}
                <div className="flex flex-col items-center rounded-xl bg-gray-50 p-3">
                  <span className="mb-1 text-xl">🍽️</span>
                  <span className={`text-lg font-bold ${mealCompliance >= 80 ? "text-emerald-600" : mealCompliance >= 50 ? "text-yellow-500" : "text-red-500"}`}>
                    {mealCompliance}%
                  </span>
                  <span className="mt-0.5 text-center text-[10px] text-gray-400">Meals</span>
                </div>
                {/* Concerns */}
                <div className="flex flex-col items-center rounded-xl bg-gray-50 p-3">
                  <span className="mb-1 text-xl">⚠️</span>
                  <span className={`text-lg font-bold ${concernCount === 0 ? "text-emerald-600" : concernCount <= 2 ? "text-yellow-500" : "text-red-500"}`}>
                    {concernCount}x
                  </span>
                  <span className="mt-0.5 text-center text-[10px] text-gray-400">Concerns</span>
                </div>
              </div>
            </div>

            {/* Daily check-in timeline */}
            {last7.length > 0 && (
              <div className="rounded-2xl bg-slate-800/60 backdrop-blur-md border border-slate-700 p-4 shadow-xl">
                <h3 className="mb-3 text-sm font-bold text-white">Daily Check-ins</h3>
                <div className="space-y-2">
                  {last7.map(c => {
                    const score = careScore(c);
                    const medOk = c.medication === "YES" || c.medication === "YA";
                    const mealOk = c.meals === "YES" || c.meals === "YA";
                    const hasConcern = c.concerns === "YES" || c.concerns === "YA";
                    return (
                      <div key={c.date} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                        <span className="w-14 shrink-0 text-xs text-gray-400">{formatDate(c.date)}</span>
                        <div className="flex flex-1 gap-1.5">
                          <span title="Medication" className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${medOk ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                            {medOk ? "MED ✓" : "MED ✗"}
                          </span>
                          <span title="Meals" className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${mealOk ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                            {mealOk ? "MEAL ✓" : "MEAL ✗"}
                          </span>
                          {hasConcern && (
                            <span className="rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-600">⚠️ NOTE</span>
                          )}
                          {c.vital && !["skip","langkau"].includes(c.vital.toLowerCase()) && (
                            <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
                              {c.vital}
                            </span>
                          )}
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${scoreColor(score)}`}>
                          {scoreLabel(score)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Vital readings */}
            {vitals.length > 0 && (
              <div className="rounded-2xl bg-slate-800/60 backdrop-blur-md border border-slate-700 p-4 shadow-xl">
                <h3 className="mb-3 text-sm font-bold text-white">
                  Vital Readings
                  <span className="ml-2 text-xs font-normal text-gray-400 capitalize">
                    {profile.mainCondition}
                  </span>
                </h3>
                <div className="space-y-2">
                  {vitals.map(c => (
                    <div key={c.date} className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-2.5">
                      <span className="text-xs text-blue-400">{formatDate(c.date)}</span>
                      <span className="font-mono text-sm font-bold text-blue-700">{c.vital}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Concern notes */}
            {concernNotes.length > 0 && (
              <div className="rounded-2xl bg-slate-800/60 backdrop-blur-md border border-slate-700 p-4 shadow-xl">
                <h3 className="mb-3 text-sm font-bold text-white">Caregiver Notes</h3>
                <div className="space-y-2">
                  {concernNotes.map(c => (
                    <div key={c.date} className="rounded-xl border border-orange-100 bg-orange-50 p-3">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-orange-400">{formatDate(c.date)}</p>
                      <p className="text-xs leading-relaxed text-gray-700">{c.concernText}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Doctor summary box */}
            <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4">
              <h3 className="mb-2 text-sm font-bold text-teal-800">For Doctor</h3>
              <div className="space-y-1 text-xs text-teal-700 leading-relaxed">
                <p>• Patient: <strong>{profile.patientName}</strong>, {profile.patientAge}y, {profile.mainCondition}</p>
                <p>• Medications: <strong>{profile.medications || "None"}</strong></p>
                <p>• 7-day medication compliance: <strong>{medicationCompliance}%</strong></p>
                <p>• 7-day meal compliance: <strong>{mealCompliance}%</strong></p>
                <p>• Concerns reported: <strong>{concernCount} times</strong> this week</p>
                <p>• Average care score: <strong>{avgScore}/100</strong></p>
                {vitals.length > 0 && (
                  <p>• Latest {profile.mainCondition?.toLowerCase().includes("diabetes") ? "blood sugar" : "blood pressure"}: <strong>{vitals[0].vital}</strong> on {formatDate(vitals[0].date)}</p>
                )}
              </div>
            </div>

            {/* Print hint */}
            <p className="text-center text-[10px] text-gray-400">
              Generated by KAI · {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        )}

        {!loading && !profile && !error && (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center z-10">
            <div className="mb-4 flex flex-row items-center justify-center gap-4">
              <img src="/report-icon.png" alt="Report Icon" className="h-14 w-auto object-contain drop-shadow-md" />
              <h2 className="text-3xl font-bold text-white tracking-wide">Patient Report</h2>
            </div>
            <p className="mb-8 text-sm font-sans text-gray-400 leading-relaxed">Enter the caregiver's WhatsApp number to load their 30-day health report.</p>
            
            <div className="flex w-full max-w-sm flex-col gap-4">
              <input
                type="tel"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="+60123456789"
                className="h-14 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 text-center text-lg font-sans text-white placeholder-gray-500 outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all"
                onKeyDown={e => e.key === "Enter" && setPhone(input.trim())}
              />
              <button
                onClick={() => setPhone(input.trim())}
                className="h-14 w-full rounded-xl bg-yellow-400 hover:bg-yellow-500 px-5 text-base font-sans font-semibold text-gray-900 shadow-sm transition-colors"
              >
                Load Report
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </IPhone13Frame>
  );
}
