# KAI — AI-Powered Home Care Coordination & Emergency Prevention

> A WhatsApp-based AI caregiver assistant built to reduce emergency department overcrowding in Malaysia's ageing society.

---

## 1. The Problem

### Malaysia Is Becoming an Aged Society

Malaysia is on track to reach **Aged Society status** — where 14% of the population is over 65 — within this decade. This demographic shift is placing unprecedented strain on a public healthcare system that was not designed to absorb it.

The burden falls in two places.

---

### Emergency Department Overcrowding

| Metric | Reality |
|---|---|
| Non-urgent elderly ED visits | 40–60% of total visits |
| Average wait time | 4–6 hours |
| Average cost per visit | ~RM 2,500 |
| Root cause | Caregivers defaulting to ED "just in case" |

Most of these visits are **preventable**. Elderly patients arrive at Emergency Departments not because of true emergencies, but because their caregivers — typically untrained family members — had no reliable way to assess whether a symptom was serious or manageable at home.

---

### The Home Care Monitoring Gap

After hospital discharge, elderly patients are sent home to recover under the supervision of family caregivers who:

- Have **no clinical training** to interpret symptoms
- Feel **uncertain and overwhelmed**, especially when something changes
- Lack a system to **track patterns** over time (missed medications, skipped meals, recurring concerns)
- Default to the Emergency Department as the safest option, even for non-urgent cases

The result: avoidable ED visits, caregiver burnout, and deteriorating patient outcomes — all compounding the strain on Malaysia's public hospitals.

---

## 2. The Solution

### KAI — Your AI Caregiver Companion

KAI is a **WhatsApp-based AI care coordination system** that gives every family caregiver in Malaysia access to 24/7 clinical guidance — with zero app downloads, zero hardware, and zero technical knowledge required.

KAI works on any phone that can send a WhatsApp message.

```
Chat → Understand → Act
```

KAI does three things that no existing solution combines:

1. **Monitors daily** — structured check-ins track medication, meals, and concerns every day
2. **Detects early** — pattern memory identifies concerning trends before they become emergencies
3. **Decides clearly** — AI triage tells caregivers exactly whether to stay home, go to a clinic, or go to A&E immediately

---

### Why WhatsApp?

WhatsApp penetration in Malaysia exceeds **85%** across all age groups, including elderly caregivers in rural and semi-urban areas. It requires no onboarding friction, no app store, and works on the cheapest Android phone with a data plan.

Every other solution in this space requires a dedicated app, a wearable device, or a trained nurse. KAI requires only a phone number.

---

## 3. How It Works

### Onboarding (One Time, ~2 Minutes)

When a caregiver messages KAI for the first time, a guided 8-step setup captures:

- Language preference (English or Bahasa Malaysia)
- Caregiver name and relationship to patient
- Patient name, age, and primary condition (Diabetes, Hypertension, Stroke recovery, Dementia)
- Current medication list
- Preferred daily check-in times

All data is stored securely in Firebase Firestore and used to personalise every subsequent interaction.

---

### Daily Check-In Flow

At the caregiver's configured times, KAI initiates a structured check-in via WhatsApp:

```
Hi Sarah 👋
Let's check on Bobby today.

1️⃣ Has Bobby taken their medication?
Reply YES or NO
```

Three questions are asked in sequence:

| Question | Purpose |
|---|---|
| Medication taken? | Track adherence; trigger advice if missed |
| Meals eaten? | Monitor nutrition; prompt intervention if skipped |
| Any concerns today? | Open the door to AI triage if YES |

Each NO answer triggers **specific, actionable advice** — not generic reminders. A missed medication response references the patient's actual medications by name.

---

### Care Score

At the end of every check-in, KAI calculates a daily Care Score:

```
📊 Bobby's Care Score Today: 85/100

• Medication: ✅
• Meals: ⚠️
• Concerns: None 👍

Status: Slightly at risk 🟡
```

| Score | Status |
|---|---|
| 100 | All good 💚 |
| 80–99 | Slightly at risk 🟡 |
| 50–79 | Needs attention ⚠️ |
| 0–49 | High risk 🔴 |

---

### Vital Sign Logging

After the Care Score, KAI asks for one condition-specific vital reading:

- **Diabetes** → Blood sugar (mmol/L)
- **Hypertension** → Blood pressure (e.g., 130/85)
- **Stroke / Dementia** → Condition score 1–5

Readings are stored daily and analysed for trends. KAI alerts the caregiver when readings are outside safe ranges or rising for three consecutive days:

```
📈 Bobby's blood pressure has risen for 3 consecutive days.
Consider a clinic visit before this becomes urgent.
```

---

### Health Memory & Pattern Detection

KAI scans the last 7 days of check-in history before every session. If concerning patterns are detected, they surface at the start of the check-in:

```
I noticed:
💊 Bobby missed medication 3x this week
🍽️ Bobby skipped meals 2x this week

Let's check in today 👇
```

When patterns cross a risk threshold, KAI triggers a structured escalation:

```
⚠️ KAI Insight:
Bobby has missed medication 3 times recently.

Would you like me to:
1️⃣ Set a medication reminder
2️⃣ Notify a family member
3️⃣ Book a teleconsult

Reply 1, 2, or 3
```

---

### AI Triage — "Should I Go to A&E?"

When a caregiver reports a concern, KAI does not give generic advice. It performs a **clinical triage assessment** using the patient's full profile — condition, medications, age, and the week's pattern history — and returns one of three clear verdicts:

**Home Care:**
```
🩺 Triage: HOME CARE

Sarah, Bobby's dizziness may be related to his blood pressure medication — this is manageable at home for now.

✅ What to do now:
• Have Bobby sit or lie down immediately
• Check blood pressure — if above 160/100, proceed to clinic
• Withhold Amlodipine until you speak to a doctor

⏰ Escalate to clinic if: dizziness worsens or Bobby becomes unresponsive
```

**Clinic Today:**
```
🩺 Triage: CLINIC TODAY

🏥 This needs a doctor but is not an emergency. Book a clinic visit today.
• Tell the doctor: recurring chest tightness since this morning, diabetic on Metformin 500mg
• While waiting: keep Bobby rested, avoid exertion

⚠️ Go to A&E instead if: pain spreads to arm or jaw, difficulty breathing
```

**Go to A&E Now:**
```
🩺 Triage: GO TO A&E NOW

🚨 Go to A&E immediately — do not wait.
📋 Show this to the doctor:
Patient: Bobby Tan, 72 — Hypertension — on Amlodipine 5mg, Metformin 500mg
Concern: sudden confusion and slurred speech since 20 minutes ago
🚗 While travelling: keep Bobby seated upright, do not give food or water
```

This triage decision is the **core of KAI's ED prevention mission** — it filters avoidable visits while ensuring real emergencies reach the hospital faster.

---

### Caregiver Wellness Check

Every 3 days, KAI asks the one question no other health app asks:

```
💙 Sarah, how are YOU holding up today?

1. I'm okay
2. A bit tired
3. Really struggling
```

Caregiver burnout is one of the leading indirect causes of patient deterioration. When caregivers are exhausted, medications get missed, symptoms go unnoticed, and ED visits increase. KAI tracks caregiver wellbeing and responds with specific, warm support — not platitudes.

---

### Bahasa Malaysia Support

KAI detects language preference during onboarding and conducts all interactions — check-ins, triage, wellness checks, AI responses — in the caregiver's chosen language.

```
Hi Sarah 👋
Mari kita semak Bobby hari ini.

1️⃣ Adakah Bobby sudah ambil ubat?
Balas YA atau TIDAK
```

This is powered by Gemini's native multilingual capability — no translation layer, no degraded quality. This matters in Malaysia where many primary caregivers, particularly in semi-urban and rural areas, are more comfortable communicating in Bahasa Malaysia.

---

### Technology Stack

| Layer | Technology |
|---|---|
| AI Orchestration | **Google Genkit** (typed flows, trace observability) |
| AI Model | **Gemini 2.0 Flash** via **Google AI (Gemini API)** |
| Database | **Firebase Firestore** (real-time, serverless) |
| Messaging | **Twilio WhatsApp Business API** |
| Runtime | Node.js + TypeScript on **Google Cloud Run** |

KAI's AI logic is structured as **Genkit flows** — fully typed with Zod schemas, observable through Genkit's built-in trace viewer, and running on Vertex AI for enterprise-grade reliability. Every triage decision and AI response is a traceable, auditable flow.

---

## System Architecture High-Level Overview 🏗️

```
┌─────────────────────────────────────────────────────────┐
│                      CAREGIVER                          │
│                  (WhatsApp Message)                     │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│               TWILIO WHATSAPP API                       │
│          (Inbound webhook / Outbound TwiML)             │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│           EXPRESS SERVER — Google Cloud Run             │
│                                                         │
│  ┌──────────────────────┐  ┌─────────────────────────┐  │
│  │    STATE MACHINE     │  │    GENKIT AI FLOWS      │  │
│  │                      │  │                         │  │
│  │  • Onboarding        │  │  aiResponseFlow         │  │
│  │  • Check-in steps    │◄►│  (Assessment + Urgency  │  │
│  │  • Vital logging     │  │   + Steps)              │  │
│  │  • Wellness check    │  │                         │  │
│  │  • Escalation        │  │  triageFlow             │  │
│  │  • Triage routing    │  │  (Home Care / Clinic /  │  │
│  └──────────────────────┘  │   A&E Now)              │  │
│                            └─────────────────────────┘  │
└──────────────┬──────────────────────────┬───────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────┐  ┌───────────────────────────┐
│   FIREBASE FIRESTORE     │  │  VERTEX AI (Google Cloud) │
│                          │  │                           │
│  users/{phone}           │  │  Gemini 2.5 Flash         │
│  • Profile & language    │  │  • Multilingual (EN / BM) │
│  • State flags           │  │  • Triage reasoning       │
│  • lastWellnessCheck     │  │  • Guided micro-actions   │
│                          │  │  • Warm, human tone       │
│  checkins/{phone_date}   │  │                           │
│  • medication / meals    │  │  Genkit Flow Tracing      │
│  • concerns / vital      │  │  • Observable end-to-end  │
│                          │  │  • Typed Zod schemas      │
│  messages/               │  │  • Auditable AI decisions │
│  • Full audit log        │  │                           │
└──────────────────────────┘  └───────────────────────────┘
```

---

## 4. Impact & Why This Matters

### Directly Addressing ED Overcrowding

KAI's triage feature directly intervenes at the moment a caregiver decides whether to go to the Emergency Department. By providing a clear, AI-driven verdict — with specific home care steps or a "go to A&E now" directive — KAI converts the caregiver's uncertainty into confident, appropriate action.

**If KAI prevents just 2 unnecessary ED visits per user per month:**

| Users | ED Visits Prevented / Month | Cost Saved (RM 2,500/visit) |
|---|---|---|
| 1,000 | 2,000 | RM 5,000,000 |
| 10,000 | 20,000 | RM 50,000,000 |

And for each visit prevented, one fewer elderly patient waits 4–6 hours in an overcrowded ED — freeing capacity for those who truly need it.

---

### Reaching Caregivers Where They Are

KAI works on any smartphone with WhatsApp. There is no app to download, no account to create beyond a phone number, and no learning curve. The Bahasa Malaysia support means KAI is accessible to caregivers who have been excluded from English-first health technology.

This is not a product for urban, tech-savvy early adopters. It is designed for the daughter in Seremban caring for her diabetic father, the son in Kuantan managing his mother's hypertension from a rented room — people who currently have no support system between the hospital and home.

---

### Caregiver Wellbeing as a Healthcare Outcome

There are an estimated **3.4 million informal caregivers** in Malaysia, most of them unpaid family members. Their mental and physical health is not tracked. Their burnout is not treated. And when they collapse — emotionally or physically — their patients suffer the consequences.

KAI is the only system in this space that treats caregiver wellbeing as a clinical variable. The wellness check is not a nice-to-have feature. It is a recognition that sustainable home care depends on the person doing the caring.

---

### The Vision

KAI is a foundation. The data it collects — daily vitals, adherence patterns, symptom trends, triage outcomes — is the raw material for:

- **Predictive hospital admission risk scoring** using historical pattern data
- **Drug interaction knowledge base** via Vertex AI Agent Builder, giving caregivers access to verified medication guidance
- **Family coordination loop** — daily health briefs sent to all registered family members, not just the primary caregiver
- **Integration with Malaysia's public telehealth infrastructure** (MySejahtera, KKiM)

Every check-in KAI completes is a data point that makes the next generation of elderly care in Malaysia smarter, earlier, and more human.

---

*Built for the Google AI Hackathon 2026 — powered by Google Genkit, Vertex AI, and Firebase.*
