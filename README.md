# KAI — Keep Alive Intelligence

> A WhatsApp-based AI caregiver assistant built for reducing emergency department overcrowding in Malaysia's ageing society — one check-in at a time.
> AI-Powered Home Care Coordination & Emergency Prevention

---

## 1. The Problem

Malaysia is on track to become an **Aged Society** (14%+ population over 65) within this decade. The strain falls on two groups: Emergency Departments and home caregivers.

| Metric | Reality |
|---|---|
| Non-urgent elderly ED visits | 40–60% of total visits |
| Average wait time per visit | 4–6 hours |
| Estimated cost per visit | ~RM 2,500 |
| Root cause | Caregivers with no clinical training defaulting to ED "just in case" |
| Informal caregivers in Malaysia | ~3.4 million unpaid family members |

Most of these visits are **preventable**. Caregivers send patients to A&E not because of true emergencies, but because they had no reliable way to tell the difference.

---

## 2. The Solution

**KAI** is a WhatsApp-based AI care coordination system that gives every family caregiver in Malaysia access to 24/7 clinical guidance — with zero app downloads, zero hardware, and zero technical knowledge required.

KAI works on any phone that can send a WhatsApp message.

**Three things no existing solution combines:**
1. **Monitors daily** — structured check-ins track medication, meals, and concerns every day
2. **Sees clearly** — dual-AI photo triage via Google Cloud Vision + Gemini Vision
3. **Decides clinically** — AI triage tells caregivers exactly whether to stay home, go to a clinic, or go to A&E

---

## 3. Full System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CAREGIVER                                 │
│              (WhatsApp — any phone, any age group)                  │
│              Text messages + Photo attachments                      │
└─────────────────────────────┬───────────────────────────────────────┘
                              │  HTTPS Webhook
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TWILIO WHATSAPP BUSINESS API                      │
│         Inbound: webhook POST to /webhook                            │
│         Outbound: TwiML response OR direct Twilio API call           │
│         Photo delivery: MediaUrl0 + MediaContentType0                │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              EXPRESS SERVER  (Node.js + TypeScript)                  │
│              whatsapp/whatsapp.ts — central state machine            │
│                                                                      │
│  ┌──────────────────────┐    ┌────────────────────────────────────┐  │
│  │   STATE MACHINE      │    │       GENKIT AI FLOWS              │  │
│  │                      │    │                                    │  │
│  │  Onboarding (10 steps│◄──►│  aiResponseFlow — general Q&A     │  │
│  │  Check-in (3 steps)  │    │  triageFlow — clinical triage      │  │
│  │  Vital logging       │    │  (HOME CARE / CLINIC / A&E)        │  │
│  │  Wellness check      │    │  analyzeImage — KAI Eyes           │  │
│  │  Escalation choice   │    │  analyzeMedicationSafety           │  │
│  │  Concern detail      │    │    — symptom-drug correlation      │  │
│  └──────────────────────┘    └────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                   KAI EYES — PHOTO PIPELINE                   │   │
│  │                                                               │   │
│  │  1. Twilio delivers photo URL + MIME type                     │   │
│  │  2. Ack caregiver immediately (beat 15s Twilio timeout)       │   │
│  │  3. Async: download image with Basic auth                     │   │
│  │  4. Google Cloud Vision API (OCR + labels + objects)          │   │
│  │  5. Gemini 2.5 Flash multimodal (clinical interpretation)     │   │
│  │  6. OpenFDA drug lookup if medication detected                │   │
│  │  7. Medication safety analysis vs recent symptoms             │   │
│  │  8. sendWhatsAppLong (auto-split at 1500 chars)               │   │
│  │  9. Family alert if A&E verdict or drug mismatch              │   │
│  └───────────────────────────────────────────────────────────────┘   │
└──────────┬──────────────────────────┬──────────────────────────────┘
           │                          │
           ▼                          ▼
┌─────────────────────┐   ┌──────────────────────────────────────────┐
│  FIREBASE FIRESTORE  │   │         GOOGLE AI SERVICES               │
│                      │   │                                          │
│  users/{phone}       │   │  Gemini 2.5 Flash (via Gemini API)       │
│  • Profile & lang    │   │  • Text: triage, Q&A, wellness           │
│  • State flags       │   │  • Multimodal: image + text prompt       │
│  • Family contact    │   │  • Multilingual: EN + Bahasa Malaysia    │
│  • Check-in times    │   │  • Medication safety correlation         │
│                      │   │                                          │
│  checkins/{phone_dt} │   │  Google Cloud Vision API                 │
│  • medication/meals  │   │  • TEXT_DETECTION (OCR drug labels)      │
│  • concerns/vital    │   │  • LABEL_DETECTION (image classification)│
│  • concernText       │   │  • OBJECT_LOCALIZATION (objects)         │
│    (symptom history) │   │  • SAFE_SEARCH_DETECTION                 │
│                      │   │                                          │
│  messages/           │   │  Google Genkit v1.32                     │
│  • Full audit log    │   │  • Typed Zod flows                       │
│  • Vision results    │   │  • Trace observability (.genkit/)        │
│                      │   │  • defineFlow + ai.generate()            │
└─────────────────────┘   └──────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL APIs (FREE, NO KEY)                    │
│                                                                      │
│  OpenFDA API                                                         │
│  • /drug/label.json — drug class, FDA warnings, brand names         │
│  • /drug/enforcement.json — active drug recalls                      │
│  • Cross-check: drug_interactions field vs full med list             │
│                                                                      │
│  node-cron Scheduler                                                 │
│  • Every minute: fire check-in at configured time                    │
│  • 30 min before check-in: medication reminder                       │
│  • 2 hours after check-in: missed check-in family alert             │
│  • Every Sunday 8pm: weekly family summary                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. AI & Technology Stack

### Core AI

| Component | Model / Service | Purpose |
|---|---|---|
| **Text triage** | Gemini 2.5 Flash via `googleai/gemini-2.5-flash` | Clinical triage: HOME CARE / CLINIC TODAY / A&E NOW |
| **General Q&A** | Gemini 2.5 Flash | Free-text caregiver questions, urgency scoring |
| **KAI Eyes vision** | Gemini 2.5 Flash multimodal | Analyze wound, medication, urine, face photos |
| **Medication safety** | Gemini 2.5 Flash | Correlate symptoms vs identified drug — flag concerns |
| **Image grounding** | Google Cloud Vision API | OCR text extraction, object/label detection before Gemini |

### AI Orchestration

| Tool | Version | Role |
|---|---|---|
| **Google Genkit** | v1.32.0 | Flow orchestration, type-safe prompts, trace logging |
| **@genkit-ai/google-genai** | v1.32.0 | Gemini API plugin for Genkit |
| **@genkit-ai/vertexai** | v1.32.0 | Vertex AI plugin (available, unused in current flows) |
| **Zod schemas** | via Genkit | Input/output validation for all AI flows |
| **Genkit trace viewer** | built-in | Debug AI flows at `http://localhost:4000` via `genkit start` |

### Infrastructure

| Tool | Version | Role |
|---|---|---|
| **Firebase Admin SDK** | v13.8 | Firestore read/write, ADC authentication |
| **Firestore** | Google Cloud | User profiles, check-in logs, symptom history |
| **Twilio WhatsApp API** | v5.13 | Inbound webhook + outbound message delivery |
| **Express** | v5.2 | HTTP server, webhook handler |
| **node-cron** | v4.2 | Scheduled check-ins, reminders, weekly summaries |
| **google-auth-library** | via Firebase SDK | Application Default Credentials for Cloud Vision |
| **OpenFDA API** | public, free | Drug labels, FDA warnings, active recalls |

### Language & Runtime

| Tool | Role |
|---|---|
| **Node.js v23** | Runtime |
| **TypeScript v5.9** | Type safety across all modules |
| **ts-node** | Direct TypeScript execution |
| **dotenv** | Environment variable management |

---

## 5. Complete Feature List

### Onboarding (10 steps, one-time setup)

- Language selection: English or Bahasa Malaysia
- Caregiver name + relationship
- Patient name, age, primary condition
- Medication list
- Preferred check-in times (supports multiple: "8am 8pm")
- Emergency family contact name + phone (optional, skippable)

All data persisted to `users/{phone}` in Firestore.

---

### Daily Check-In (automated, cron-scheduled)

- Fires at caregiver-configured times every day
- 3 structured questions: medication taken, meals eaten, any concerns
- Per-question NO responses trigger specific advice (not generic)
- Check-in data saved to `checkins/{phone}_{date}`
- Daily Care Score (0–100) shown at end of check-in

---

### Vital Sign Logging

- Condition-specific: Blood sugar (diabetes), Blood pressure (hypertension), Condition score 1–5 (stroke/dementia)
- Stored per day; last 7 readings loaded for trend analysis
- Alerts on: critically low/high values, 3 consecutive days of rising readings
- Family auto-notified if 🚨 critical alert fires

---

### Pattern Memory (7-day lookback)

- Tracks: missed medication count, skipped meal count, raised concerns count
- Surfaced at start of each check-in as personalised observation
- Escalation threshold: ≥2 missed meds or skipped meals in a week
- Burnout threshold: ≥3 concern flags in a week

---

### AI Triage

- Triggered when caregiver describes a concern after check-in
- Input: concern text + full patient profile + 7-day pattern history
- Output: HOME CARE / CLINIC TODAY / GO TO A&E NOW with specific steps
- CLINIC TODAY responses include teleconsult links (DoctorOnCall + KKMNow)
- A&E verdict triggers immediate family WhatsApp alert

---

### KAI Eyes — Photo Triage

- Caregiver sends any photo (wound, medication, urine, face/eyes)
- Immediate acknowledgment to beat Twilio's 15-second response timeout
- **Stage 1 — Google Cloud Vision API:**
  - OCR: extracts all text (drug names, dosage, expiry)
  - Label detection: classifies visual content (wound, pill, face, etc.)
  - Object localization: identifies specific objects
  - Results injected into Gemini as "verified machine data"
- **Stage 2 — Gemini 2.5 Flash multimodal:**
  - Clinical interpretation grounded by Cloud Vision facts
  - 5 categories: WOUND_SKIN, MEDICATION, URINE, EYES_FACE, NOT_MEDICAL
  - Structured output: What I see → Clinical interpretation → Triage verdict
  - For MEDICATION: full drug check (name, dosage, expiry, match vs patient records)
- **Stage 3 — OpenFDA enrichment** (if medication detected):
  - Drug class + FDA warnings
  - Active recall check
  - Drug interaction cross-check vs full medication list
- **Stage 4 — Symptom safety analysis** (if medication + recent symptoms):
  - Gemini correlates last 7 days of symptom notes vs identified drug
  - Flags known side-effect patterns (observational only, never prescribes)
  - Hard disclaimer appended: "Do not change medication without consulting your doctor"
- Long responses auto-split into multiple WhatsApp messages (1500 char limit)
- Family alert sent if A&E verdict or drug mismatch detected

---

### Medication Intelligence

- `/updatemeds <list>` — updates patient medication list in Firestore
- Runs OpenFDA drug interaction check across full medication list on update
- Symptom notes saved every time caregiver describes a concern
- Medication photos correlate against 7 days of saved symptom history
- Safety framing: flags concerns, never instructs to give or withhold medication

---

### Medication Reminders

- Fires 30 minutes before each scheduled check-in time
- Lists patient's actual medications by name
- Only fires if `user.medications` is set

---

### Family Contact System

| Trigger | Alert Sent To |
|---|---|
| A&E triage verdict | Family WhatsApp |
| Emergency urgency from free-text | Family WhatsApp |
| Medication mismatch in photo | Family WhatsApp |
| Critically abnormal vital (🚨) | Family WhatsApp |
| Caregiver burnout (3+ concerns/week) | Family WhatsApp |
| Caregiver reports "really struggling" | Family WhatsApp |
| Escalation choice 2 | Weekly summary to family |
| No check-in response for 2+ hours | Family WhatsApp (missed check-in alert) |
| Every Sunday 8pm | Weekly care summary to family |

---

### Weekly Family Summary

- Sent every Sunday at 8pm via node-cron
- Includes: medication adherence (7-day), meal consistency, concern count
- Weekly Care Score (0–100) calculated from patterns
- Sent to `user.familyPhone` if registered

---

### Caregiver Wellness Check

- Fires every 3 days (configurable via `lastWellnessCheck`)
- 3-option response: "I'm okay" / "A bit tired" / "Really struggling"
- Warm, specific support responses — not generic platitudes
- "Really struggling" triggers family alert and shows crisis resources:
  - Befrienders KL: 03-7627 2929 (24hr)
  - MIASA: +603 2780 6803

---

### Escalation Menu

Shown when ≥2 missed meds or skipped meals detected in a week:
```
1️⃣ Set a medication reminder
2️⃣ Notify a family member
3️⃣ Book a teleconsult
```
Each choice has real action: reminder set / family WhatsApp sent / teleconsult links sent.

---

### Web Frontend (Next.js 15)

**Login Page** (`/`)
- Animated video carousel background (caregiver.mp4, feed.mp4, shirt.mp4)
- Sign in form with username/password + Google sign-in button
- Sign up button routes to `/onboarding`

**Web Onboarding** (`/onboarding`)
- 9-step guided form matching WhatsApp onboarding fields exactly
- Bilingual (English / Bahasa Malaysia) toggled in step 1
- Quick-select chips for relationship, condition, check-in time
- Saves profile to Firestore via POST `/api/onboard`
- Completion screen: Twilio number + join code to copy, Open WhatsApp button
- After clicking Open WhatsApp: 5-second countdown then auto-redirects to `/report`

**Caregiver Dashboard** (`/home`)
- Loads patient data via GET `/api/report?phone=`
- **Home tab:** greeting, patient summary chip with avg care score, today's check-in status (medication taken/missed, meals eaten/missed), 7-day bar chart, latest vital reading, quick action grid, current medications reminder
- **Report tab:** full 30-day clinical report (same as `/report`) embedded inline
- **Settings tab:** account info, check-in time, re-run onboarding, logout
- Bottom navigation bar switching between all three tabs

**Health Report** (`/report`)
- Shareable standalone URL: `/report?phone=+60123456789`
- Patient profile card: name, age, condition, caregiver, relationship, medications, emergency contact
- 7-day compliance stats: medication %, meal %, concern count (colour-coded)
- Daily check-in timeline: MED ✓/✗, MEAL ✓/✗, concern flag, vital, care score badge per day
- Vital readings history (blood sugar / BP depending on condition)
- Caregiver free-text notes with dates
- "For Doctor" clinical bullet summary
- Generated timestamp footer

---

### Bilingual Support (EN + Bahasa Malaysia)

- Set once during onboarding, applied to every interaction
- All check-in questions, triage responses, wellness checks, alerts in BM or EN
- Gemini generates native BM — not translated, not degraded

---

## 6. All User Scenarios — End to End

### Scenario 1: First-time Setup

```
Caregiver messages KAI for first time
→ Language selection (EN / BM)
→ 10-step guided onboarding
→ Profile saved: name, patient, condition, medications, check-in times, family contact
→ Completion message with full summary
```

---

### Scenario 2: Daily Check-In (All Good)

```
[8:00 AM — cron fires]
KAI: "Hi Sarah 👋 Has Bobby taken their medication? YES or NO"
Sarah: YES
KAI: "Great 👍 Thanks for confirming. Has Bobby eaten their meals? YES or NO"
Sarah: YES
KAI: "Wonderful 😊 Any concerns about Bobby today? YES or NO"
Sarah: NO
KAI: "📊 Bobby's Care Score Today: 100/100 ✅ All good 💚"
KAI: "💉 What was Bobby's blood sugar today? (e.g., 7.2 mmol/L) — or type skip"
Sarah: 6.4
KAI: "✅ Recorded: 6.4"
```

---

### Scenario 3: Missed Medication + Concern Raised

```
[8:00 AM — cron fires]
KAI: "Has Bobby taken their medication?"
Sarah: NO
KAI: "⚠️ It looks like Bobby may have missed medication.
     Recommended:
     • Give medication if safe to do so
     • If unsure, check prescription or contact doctor
     
     2️⃣ Has Bobby eaten their meals? YES or NO"
Sarah: YES
KAI: "Any concerns about Bobby today?"
Sarah: YES
KAI: "I hear you 💙 What concerns are you noticing about Bobby?
     Describe what's happening and I'll help you assess."
Sarah: "Bobby has been dizzy since this morning and can't stand up properly"
KAI: [Gemini triage with patient profile + 7-day patterns]
     "🩺 Triage: CLINIC TODAY
     🏥 This needs a doctor's assessment today — not an emergency.
     • Tell the doctor: dizziness with difficulty standing since morning, diabetic on Metformin 500mg + Amlodipine 5mg, missed medication this morning
     • While waiting: have Bobby sit or lie down, check if medication was taken yesterday
     ⚠️ Go to A&E instead if: Bobby becomes unresponsive or speech becomes slurred
     
     🏥 Book now:
     • DoctorOnCall: https://www.doctoroncall.com.my
     • KKMNow: https://kkmapp.moh.gov.my"
```

---

### Scenario 4: KAI Eyes — Medication Photo

```
Sarah sends photo of Apidra SoloStar insulin pen
Caption: "may i consume this"

KAI: "👁️ KAI Eyes is analyzing your photo... Results will arrive in a few seconds."

[Async pipeline:]
  Cloud Vision → OCR: "Apidra SoloStar Insulin glulisine 100 IU/mL SANOFI 5 SOLOSTAR injection pens"
  Cloud Vision → Labels: "Medicine 95%, Medical equipment 89%"
  Gemini → Grounded by OCR text:

KAI: "👁️ KAI Eyes Assessment

🔍 What I see:
Apidra SoloStar insulin glulisine 100 IU/mL injection pen by Sanofi. Label clearly readable.

🩺 Clinical interpretation:
This is a rapid-acting insulin — for Bobby who is diabetic, timing of this injection is critical relative to meals. Confirm it matches the prescribed insulin type.

📊 Triage: HOME CARE

💊 Medication Check:
• Identified: Apidra (insulin glulisine) 100 IU/mL
• Match with Bobby's records: ✅ Correct medication
• Dosage: 100 IU/mL (confirm prescribed units with doctor)
• Expiry: Not visible in photo
• Action: Verify the prescribed dose and inject within 15 minutes of a meal

✅ What to do now:
• Ensure Bobby has eaten or is about to eat before injecting
• Inject at prescribed dose per doctor's instructions
• Monitor for hypoglycemia (shaking, sweating, confusion) for 1-2 hours

📋 FDA-Verified Drug Info (OpenFDA):
💊 Drug class: Insulin [Human] [EPC]
⚠️ FDA warning: Hypoglycemia is the most common adverse reaction..."

[If recent symptom notes exist, adds:]
"🔍 KAI Insight — Medication Safety Analysis:
Bobby reported dizziness 2 days ago. Dizziness can be a symptom of hypoglycemia — a known risk with rapid-acting insulin. Worth discussing with your doctor before the next dose.
⚠️ This is an observational flag only. Do not change any medication without consulting your doctor."
```

---

### Scenario 5: KAI Eyes — Wound Photo

```
Sarah sends photo of skin rash on Bobby's leg

KAI: "👁️ KAI Eyes Assessment

🔍 What I see:
Reddish, slightly raised skin area approximately 3-4cm in diameter on the lower leg. No visible open wound or discharge.

🩺 Clinical interpretation:
For Bobby who has diabetes, any skin change on the lower limbs carries higher risk due to impaired circulation and healing. This warrants monitoring.

📊 Triage: HOME CARE

✅ What to do now:
• Keep the area clean and dry
• Do not apply any cream or ointment without doctor advice
• Monitor for spreading redness or warmth

📸 Track it: Take another photo in 24 hours to monitor for changes.
⏰ Escalate to clinic if: redness spreads beyond the affected area, or skin breaks open"
```

---

### Scenario 6: A&E Verdict — Family Alert Fired

```
Sarah: "Bobby suddenly can't speak properly and his face looks droopy on one side"

KAI: "🩺 Triage: GO TO A&E NOW
     🚨 Go to A&E immediately — do not wait.
     📋 Show this to the doctor:
     Patient: Bobby Tan, 72 — Hypertension — on Amlodipine 5mg, Metformin 500mg
     Concern: sudden facial drooping and speech difficulty — possible stroke
     🚗 While travelling: keep Bobby seated upright, do not give food or water"

[Family alert fired to registered family WhatsApp:]
"🚨 EMERGENCY — KAI Alert
Sarah has been advised to take Bobby to A&E immediately.
Please call them now."
```

---

### Scenario 7: Weekly Pattern Escalation

```
[After 3 days of missed medication detected]
KAI: "I noticed:
     💊 Bobby missed medication 3x this week
     🍽️ Bobby skipped meals 2x this week
     
     ⚠️ KAI Insight:
     Bobby has missed medication 3 times recently.
     
     Would you like me to:
     1️⃣ Set a medication reminder
     2️⃣ Notify a family member
     3️⃣ Book a teleconsult
     
     Reply 1, 2, or 3"

Sarah: 2
KAI: "📲 Message sent to Ahmad (family member)."
[Family receives weekly summary + pattern alert]
```

---

### Scenario 8: Wellness Check

```
[Every 3 days, appended after check-in summary]
KAI: "💙 Sarah, how are YOU holding up today?
     1. I'm okay
     2. A bit tired  
     3. Really struggling"

Sarah: 3
KAI: "Sarah, you're doing something incredibly hard. Your feelings are valid.
     
     🆘 Support resources:
     • Befrienders KL: 03-7627 2929 (24hr)
     • MIASA: +603 2780 6803
     
     You are not alone in this 💙"
[Family quietly alerted]
```

---

### Scenario 9: Update Medication List + Interaction Check

```
Sarah: /updatemeds Metformin 500mg, Amlodipine 5mg, Warfarin 5mg, Aspirin 100mg

KAI: "💊 Medication list updated for Bobby:
     Metformin 500mg, Amlodipine 5mg, Warfarin 5mg, Aspirin 100mg
     
     ⚠️ Drug Interactions Found (source: RxNorm / NLM):
     🔴 Warfarin + Aspirin:
        ...concurrent use of aspirin may increase bleeding risk with warfarin...
     🟡 Metformin + Amlodipine:
        ...monitor blood glucose levels when used together..."
```

---

## 7. Demo Flow (Hackathon Script)

**Step 1** — Open WhatsApp on demo phone, send "Hi" to KAI number  
→ Shows: onboarding starts in chosen language

**Step 2** — Complete onboarding in 60 seconds with pre-filled responses  
→ Shows: personalised profile saved, completion message

**Step 3** — Trigger `/checkin`  
→ Shows: memory observation + check-in questions fire

**Step 4** — Answer: medication NO → meals YES → concerns YES → describe symptom  
→ Shows: AI triage fires with patient-specific steps + teleconsult links

**Step 5** — Send Apidra insulin photo with caption "may i consume this"  
→ Shows: immediate ack → Cloud Vision OCR → Gemini clinical interpretation → FDA data → symptom correlation

**Step 6** — Send `/updatemeds Warfarin 5mg, Aspirin 100mg`  
→ Shows: interaction warning flags immediately

**Step 7** — Trigger A&E verdict (describe stroke symptoms)  
→ Shows: A&E output + family phone receives alert in real-time

**Step 8** — Sunday cron demo: show weekly summary message received on family phone  
→ Shows: full care score, adherence summary, caregiver attribution

**Step 9** — Open web app, click Sign Up, complete 9-step onboarding, click Open WhatsApp  
→ Shows: profile saved to Firestore, 5-second countdown, auto-redirect to /report

**Step 10** — Open `/home?phone=+60xxxxxxxxx` in browser  
→ Shows: live dashboard with today's check-in status, 7-day bar chart, latest vital, full report tab, doctor-ready summary

---

## 8. Codebase Structure

```
myai2026/
├── whatsapp/
│   ├── whatsapp.ts        Central Express server + state machine (all routing)
│   ├── ai.ts              General Q&A Genkit flow (aiResponseFlow)
│   ├── triage.ts          Clinical triage Genkit flow (triageFlow)
│   ├── vision.ts          KAI Eyes: download image + Gemini multimodal analysis
│   ├── cloud-vision.ts    Google Cloud Vision API wrapper (OCR + labels)
│   ├── medical-api.ts     OpenFDA lookup + drug interactions + medication safety AI
│   ├── onboarding.ts      10-step guided onboarding state machine
│   ├── checkin.ts         Check-in questions, scoring, cron scheduler
│   ├── memory.ts          7-day pattern analysis, vital trends, symptom storage
│   ├── wellness.ts        Caregiver wellness check logic
│   ├── notify.ts          Twilio sendWhatsApp + sendWhatsAppLong (auto-split)
│   ├── firebase.ts        Firestore init via ADC
│   ├── genkit.ts          Genkit init with Google AI plugin
│   ├── test-bot.ts        Local bot logic test runner
│   ├── test-ai.ts         Genkit AI flow test runner
│   └── test-firestore.ts  Firestore connectivity test
├── app/                   Next.js 15 web frontend (App Router)
│   ├── page.tsx           Login page — animated video background + sign-in form
│   ├── onboarding/
│   │   └── page.tsx       9-step web onboarding + WhatsApp connect screen
│   │                        → auto-redirects to /report after connecting
│   ├── home/
│   │   └── page.tsx       Caregiver dashboard — 3 tabs:
│   │                        Home: today's check-in, 7-day bar chart, latest vital
│   │                        Report: full 30-day clinical report
│   │                        Settings: account + WhatsApp preferences
│   ├── report/
│   │   └── page.tsx       Standalone health report — shareable with doctors/family
│   │                        Patient profile, compliance %, vitals, caregiver notes,
│   │                        "For Doctor" clinical summary
│   └── api/
│       ├── onboard/
│       │   └── route.ts   POST /api/onboard — saves profile to Firestore
│       └── report/
│           └── route.ts   GET /api/report?phone= — fetches 30-day check-in history
├── components/
│   └── iPhone13Frame.tsx  Mobile device chrome wrapper (demo presentation)
├── tsconfig.backend.json  TypeScript config for backend (commonjs, node resolution)
├── tsconfig.json          Next.js frontend TypeScript config
└── .env                   Environment variables
```

---

## 9. Environment Setup

### Required Environment Variables (`.env`)

```bash
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Google AI (Gemini)
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Google Cloud (Firestore + Cloud Vision)
GOOGLE_CLOUD_PROJECT=kai2026
# No key file needed — uses Application Default Credentials (ADC)

# Web frontend
NEXT_PUBLIC_TWILIO_JOIN_CODE=join <your-sandbox-word>
```

### ADC Setup (one-time)

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project kai2026
```

### Google Cloud APIs to Enable

```
Cloud Vision API
Cloud Firestore API
```

### Twilio Setup

1. Create a WhatsApp Sandbox at twilio.com/console
2. Set webhook URL to `https://your-ngrok-url/webhook` (POST)
3. Test with sandbox join code

---

## 10. Running the Bot

```bash
# Install dependencies
npm install

# Run backend server
npm run backend
# or directly:
npx ts-node --project tsconfig.backend.json whatsapp/whatsapp.ts

# Expose to Twilio via ngrok
ngrok http 8080

# Test AI flow only
npx ts-node --project tsconfig.backend.json whatsapp/test-ai.ts

# Test Firestore connectivity
npx ts-node --project tsconfig.backend.json whatsapp/test-firestore.ts

# Test bot logic (no Twilio needed)
npx ts-node --project tsconfig.backend.json whatsapp/test-bot.ts

# Inspect Genkit traces (AI flow debugger)
npx genkit start
# Open http://localhost:4000
```

---

## 11. Extended Knowledge — Unused but Useful Google Tools

These tools are installed or available but not yet fully wired into the current flow. Relevant for future development:

---

### Google Cloud Speech-to-Text

WhatsApp allows voice notes. A caregiver sending a voice note could be transcribed and fed into the triage flow:

```
Voice note → Speech-to-Text API → text → getTriageResponse()
```

Relevant for elderly caregivers who cannot type easily.

---

### Google Cloud Natural Language API

Could be used to extract medical entities (symptoms, body parts, medications) from free-text caregiver messages before triage, improving accuracy:

- Entity extraction: `analyzeEntities()` → identify drug names, body parts, symptoms
- Sentiment analysis: detect distressed caregiver before triage runs

---

### Firebase Cloud Messaging (FCM)

For a future companion mobile app, FCM could deliver push notifications alongside WhatsApp:
- Medication reminders with one-tap "Confirm" action
- Care score daily summary as a notification card

---

### Vertex AI Agent Builder (formerly Dialogflow CX)

Could replace the current custom state machine for onboarding and check-in flows with a visual agent designer. Benefits:
- Drag-and-drop conversation flows
- Built-in slot filling (instead of manual step tracking in Firestore)
- Integrated knowledge base for medication Q&A

---

### Google Maps Platform — Nearest A&E Locator

When triage says "GO TO A&E NOW", append the nearest hospital:

```typescript
const mapsUrl = `https://www.google.com/maps/search/hospital+emergency/@${lat},${lng},13z`;
```

Requires user location (WhatsApp location sharing) or postcode from onboarding.

---

### Looker Studio Dashboard

Connect Firestore → BigQuery → Looker Studio to build a real-time operations dashboard showing:
- Active users by region
- Care score distribution
- A&E vs Clinic vs Home Care triage split
- Medication adherence rates

---

## 12. Impact & Vision

### ED Prevention at Scale

If KAI prevents just **2 unnecessary ED visits per user per month**:

| Users | Visits Prevented / Month | Cost Saved (RM 2,500/visit) |
|---|---|---|
| 1,000 | 2,000 | RM 5,000,000 |
| 10,000 | 20,000 | RM 50,000,000 |

Each visit prevented frees capacity for patients who truly need emergency care.

### Why WhatsApp

WhatsApp penetration in Malaysia exceeds **85%** across all age groups including rural and elderly caregivers. No app download. No account creation. Works on the cheapest Android phone with a data plan.

### The Future

- **Predictive admission risk scoring** from 30-day vital + adherence patterns
- **MySejahtera / KKiM integration** — sync triage decisions with Malaysia's national health system
- **Multi-patient support** — one caregiver, multiple family members
- **Hospital discharge protocol** — KAI auto-activates when patient is discharged, following the doctor's specific home care plan

---

*Built for the Google AI Hackathon 2026*  
*Stack: Google Genkit · Gemini 2.5 Flash · Google Cloud Vision · Firebase Firestore · Twilio WhatsApp API · OpenFDA · Node.js + TypeScript*
