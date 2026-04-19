# KAI — AI-Powered Home Care Coordination & Emergency Prevention

> A WhatsApp-based AI caregiver assistant built to reduce emergency department overcrowding in Malaysia's ageing society.

---

## The Problem 🏥

Malaysia is transitioning into an **Aged Society**, putting severe pressure on a healthcare system that was never designed to absorb it. The burden shows up in two critical places.

1. **Emergency Department Overcrowding:** 40–60% of elderly ED visits are non-urgent and could have been handled at home or at a clinic. Each visit costs approximately RM 2,500, generates 4–6 hour wait times, and consumes capacity that genuine emergencies need. The root cause is not medical — it is a decision-making gap at home.

2. **Untrained Family Caregivers Left Alone:** The majority of elderly Malaysians are cared for by untrained family members — a daughter, a spouse, a grandchild. When something changes, they have no system to assess severity. Their default response is the Emergency Department, not because the patient needs it, but because the caregiver has no better option.

3. **No Daily Monitoring Between Hospital Visits:** After discharge, elderly patients return home with no structured follow-up. Early warning signs — missed medications, declining appetite, subtle behavioural changes — go undetected until a crisis forces another hospital visit.

4. **Caregiver Burnout Goes Untracked:** An estimated 3.4 million informal caregivers in Malaysia receive no support, no monitoring, and no recognition. Their burnout directly worsens patient outcomes — missed medications, delayed symptom recognition, and more ED visits.

5. **Language and Technology Barriers:** Existing health technology is English-first, app-dependent, and designed for urban, tech-savvy users. It does not reach the caregiver in Seremban, Kuantan, or Kelantan who communicates in Bahasa Malaysia and cannot afford or navigate a dedicated health app.

6. **Vital Signs Are Never Tracked at Home:** For elderly patients with Diabetes or Hypertension, daily readings (blood sugar, blood pressure) are the most reliable early indicators of deterioration. Yet no simple, accessible system exists to capture and trend this data from home.

---

## The Solution 🔑

KAI is a **WhatsApp-based AI care coordination system** that meets caregivers where they already are — on WhatsApp, in their own language — and gives them the clinical confidence to act early instead of defaulting to the Emergency Department.

1. **Zero-Friction Access via WhatsApp:** KAI requires no app download, no account creation, and no technical knowledge. It works on any smartphone with WhatsApp — the platform already used by over 85% of Malaysians across all age groups and regions. The barrier to entry is zero.

2. **AI Triage — "Should I Go to A&E?":** When a caregiver reports a concern, KAI performs a full clinical triage assessment using the patient's condition, medications, age, and weekly history. It returns one of three clear verdicts — **Home Care**, **Clinic Today**, or **Go to A&E Now** — with specific, actionable steps for each. This directly intercepts unnecessary ED visits at the moment of decision.

3. **Daily Structured Check-Ins with Health Memory:** KAI initiates daily check-ins at the caregiver's configured times, tracking medication adherence, meals, and concerns. It scans the last 7 days of history to detect patterns — missed medications, recurring concerns, declining nutrition — and surfaces them at the start of each session before they become emergencies.

4. **Condition-Specific Vital Sign Logging:** After every check-in, KAI asks for one daily vital reading tailored to the patient's condition — blood sugar for Diabetes, blood pressure for Hypertension, a condition score for Stroke and Dementia. It trends these readings over time and alerts caregivers when values are outside safe ranges or rising consecutively.

5. **Caregiver Wellness Check — The Human Layer:** Every three days, KAI asks the caregiver how they are holding up. If exhaustion or distress is reported, KAI responds with specific support and encourages family redistribution of care. This is the only feature in this space that treats caregiver wellbeing as a clinical variable — because caregiver collapse leads directly to patient deterioration.

6. **Full Bahasa Malaysia Support:** KAI conducts all interactions — onboarding, check-ins, triage, AI responses, escalation alerts — in the caregiver's preferred language, powered by Gemini's native multilingual capability. This makes KAI the first AI care system in Malaysia designed for the caregivers who need it most, not just those who can navigate English-first technology.

---

## How Our Project Works ⚙️

**Onboarding — One Time, Under 2 Minutes**

A new caregiver sends a WhatsApp message to KAI's number. An 8-step guided setup captures language preference, caregiver name, patient name and age, primary condition, current medication list, and preferred check-in times. All data is stored in Firebase Firestore and used to personalise every interaction going forward.

**Daily Check-In Flow**

At the caregiver's configured times, KAI initiates a structured 3-question check-in via WhatsApp:

- **Medication taken?** — If NO, KAI provides specific advice referencing the patient's actual medications by name
- **Meals eaten?** — If NO, KAI suggests appropriate interventions (light foods, fluids, small frequent meals)
- **Any concerns today?** — If YES, KAI transitions directly into the AI Triage flow

**Care Score**

At the end of every check-in, KAI calculates a daily Care Score (0–100) based on medication adherence (50 pts), meals (15 pts), and no concerns (35 pts). The score is presented with a status label — All Good, Slightly at Risk, Needs Attention, or High Risk — giving caregivers an immediate, intuitive picture of their patient's day.

**Vital Sign Logging**

After the Care Score, KAI asks for one condition-specific vital reading. Readings are stored per day in Firestore and analysed against the previous 7 days. If a reading is critically out of range or has been rising for three consecutive days, KAI issues an alert with a specific recommended action.

**Health Memory & Pattern Detection**

Before every check-in, KAI scans the last 7 days of history. If the patient has missed medication 2+ times or skipped meals 2+ times, KAI surfaces this observation at the start of the session. When patterns cross a risk threshold, KAI presents a structured escalation menu — set a medication reminder, notify a family member, or book a teleconsult.

**AI Triage Flow**

When a caregiver describes a concern, KAI's Genkit-powered triage flow processes the full patient context — condition, medications, age, weekly pattern history — and returns one of three clearly structured responses:

- 🟢 **HOME CARE** — specific step-by-step actions and warning signs to watch for
- 🟡 **CLINIC TODAY** — what to tell the doctor and what to do while waiting
- 🔴 **GO TO A&E NOW** — a pre-formatted patient handoff summary the caregiver can show the doctor on arrival

**Caregiver Wellness Check**

Every 3 days, following the vital log, KAI asks the caregiver how they are doing (3 options: okay / tired / struggling). Each response triggers a tailored reply. If the caregiver is struggling, KAI encourages family support redistribution and reminds them that their wellbeing is part of the patient's care.

**Bahasa Malaysia Support**

Language is selected during onboarding. From that point, every message KAI sends — check-in questions, feedback, summaries, triage verdicts, escalation menus — is delivered in the caregiver's chosen language. The AI model (Gemini 2.5 Flash) handles Bahasa Malaysia natively with no translation layer.

---

## System Architecture High-Level Overview 🏗️

```
┌─────────────────────────────────────────────────────────────────┐
│                        CAREGIVER                                │
│                    (WhatsApp Message)                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   TWILIO WHATSAPP API                           │
│              (Inbound webhook / Outbound TwiML)                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              EXPRESS SERVER — Google Cloud Run                  │
│                                                                 │
│   ┌─────────────────────┐    ┌──────────────────────────────┐  │
│   │   STATE MACHINE     │    │      GENKIT AI FLOWS         │  │
│   │                     │    │                              │  │
│   │  • Onboarding       │    │  aiResponseFlow              │  │
│   │  • Check-in steps   │◄──►│  (Assessment + Urgency +     │  │
│   │  • Vital logging    │    │   Steps)                     │  │
│   │  • Wellness check   │    │                              │  │
│   │  • Escalation       │    │  triageFlow                  │  │
│   │  • Triage routing   │    │  (Home Care / Clinic /       │  │
│   └──────────┬──────────┘    │   A&E Now)                   │  │
│              │               └──────────────┬───────────────┘  │
│              │                              │                   │
└──────────────┼──────────────────────────────┼───────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────┐   ┌──────────────────────────────────┐
│   FIREBASE FIRESTORE     │   │      VERTEX AI (Google Cloud)    │
│                          │   │                                  │
│  users/{phone}           │   │  Gemini 2.5 Flash                │
│  • Profile & language    │   │  • Multilingual (EN / BM)        │
│  • State flags           │   │  • Triage reasoning              │
│  • lastWellnessCheck     │   │  • Guided micro-actions          │
│                          │   │  • Warm, human tone              │
│  checkins/{phone_date}   │   │                                  │
│  • medication / meals    │   │  Genkit Flow Tracing             │
│  • concerns / vital      │   │  • Observable end-to-end         │
│                          │   │  • Typed Zod schemas             │
│  messages/               │   │  • Auditable AI decisions        │
│  • Full audit log        │   │                                  │
└──────────────────────────┘   └──────────────────────────────────┘
```

| Component | Technology |
|---|---|
| AI Orchestration | Google Genkit (typed flows + trace observability) |
| AI Model | Gemini 2.5 Flash on Vertex AI |
| Database | Firebase Firestore |
| Messaging | Twilio WhatsApp Business API |
| Deployment | Google Cloud Run (serverless) |
| Language | TypeScript + Node.js |

---

## Impact & Why This Matters 💙

**Preventing Emergency Visits Before They Happen**

KAI intervenes at the exact moment a caregiver decides whether to go to the Emergency Department. The triage flow does not replace doctors — it answers the one question every caregiver is actually asking: *"Is this serious enough to go now?"* By giving a clear, AI-driven answer with specific home care steps, KAI prevents the visits that should never have happened.

| Active Users | ED Visits Prevented / Month | Estimated Savings (RM 2,500/visit) |
|---|---|---|
| 1,000 | 2,000 | RM 5,000,000 |
| 10,000 | 20,000 | RM 50,000,000 |

**Reaching the Caregivers Who Are Actually Left Behind**

KAI is not built for urban, English-speaking, tech-savvy early adopters. It is built for the daughter in Seremban, the son in Kuantan, the spouse in a kampung managing hypertension after years of following doctors' instructions without understanding them. WhatsApp access and Bahasa Malaysia support mean KAI reaches the caregivers who have no other option.

**Making the Invisible Visible**

Caregiver burnout, vital sign trends, weekly medication patterns — none of this data currently exists in any structured form for home-based elderly care in Malaysia. KAI generates it as a byproduct of every interaction. Over time, this data is the foundation for predictive risk scoring, proactive intervention, and evidence-based home care policy.

**The Vision Beyond the Hackathon**

- Predictive hospital admission risk scoring from pattern history
- Drug interaction knowledge base via Vertex AI Agent Builder
- Family coordination loop — daily health briefs to all registered family members
- Integration with MySejahtera and KKiM telehealth infrastructure
- Community health worker dashboard for district-level monitoring

Every check-in KAI completes is a data point that makes elderly care in Malaysia smarter, earlier, and more human.

---

*Built for the Google AI Hackathon 2026 — powered by Google Genkit, Vertex AI, Firebase, and Twilio.*
