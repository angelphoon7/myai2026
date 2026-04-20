import { ai } from './genkit';
import { getMedicalContext, analyzeMedicationSafety } from './medical-api';
import { analyzeWithCloudVision, buildVisionContext } from './cloud-vision';

type Lang = "en" | "ms";

export interface VisionContext {
  caregiverName: string;
  patientName: string;
  patientAge?: string;
  condition?: string;
  medications?: string;
  language?: Lang;
  caption?: string;
  recentSymptoms?: string[];
}

export async function downloadTwilioImage(
  mediaUrl: string
): Promise<{ base64: string; mimeType: string }> {
  const auth = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  ).toString("base64");

  console.log("Downloading Twilio image:", mediaUrl.substring(0, 60) + "...");

  const response = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${auth}` },
    redirect: "follow",
  });

  console.log("Download status:", response.status, "type:", response.headers.get("content-type"));

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Image download failed: ${response.status} ${body.substring(0, 100)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength === 0) throw new Error("Downloaded image is empty");

  console.log("Downloaded bytes:", arrayBuffer.byteLength);

  const base64 = Buffer.from(arrayBuffer).toString("base64");
  // Strip charset and extra params from content-type: "image/jpeg; charset=utf-8" → "image/jpeg"
  const rawType = response.headers.get("content-type") || "image/jpeg";
  const mimeType = rawType.split(";")[0].trim();
  return { base64, mimeType };
}

export async function analyzeImage(
  ctx: VisionContext,
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const lang = ctx.language ?? "en";
  const langLine =
    lang === "ms" ? "Respond entirely in Bahasa Malaysia." : "Respond in English.";
  const captionLine = ctx.caption
    ? `Caregiver's note: "${ctx.caption}"`
    : "No caption — analyze the image directly.";

  // Run Cloud Vision in parallel with prompt construction — non-blocking if it fails
  let visionContext = "";
  try {
    const cvResult = await analyzeWithCloudVision(imageBase64);
    visionContext = buildVisionContext(cvResult);
  } catch (e) {
    console.warn("Cloud Vision unavailable, proceeding with Gemini only:", e);
  }

  const promptText = `You are KAI Eyes, a visual medical triage assistant for home caregivers in Malaysia. ${langLine}

Patient context:
- Patient: ${ctx.patientName}, Age: ${ctx.patientAge ?? "elderly"}
- Known condition: ${ctx.condition ?? "not specified"}
- Current medications: ${ctx.medications ?? "not specified"}
- Caregiver: ${ctx.caregiverName}
- ${captionLine}
${visionContext ? `\n${visionContext}\nUse the above machine-verified data (OCR text, detected labels, objects) to ground your analysis. Treat extracted text and object labels as confirmed facts.\n` : ""}
STEP 1 — Classify this image into ONE category:
• WOUND_SKIN — wound, cut, burn, bruise, rash, pressure sore, swelling, edema, skin discoloration
• MEDICATION — pills, tablets, capsules, medication bottle, blister pack, prescription label
• URINE — urine in toilet bowl, container, or pad
• EYES_FACE — facial swelling, yellow eyes/skin (jaundice), facial asymmetry (stroke sign)
• NOT_MEDICAL — image does not appear medically relevant

If NOT_MEDICAL, respond only with:
"I can see this image but it doesn't appear to show a medical concern. If you have a health question, describe it in text or send a photo of the symptom directly."

STEP 2 — Analyze based on category:

For WOUND_SKIN:
- Describe: color, approximate size, location on body, any visible drainage or pus, wound edges
- Infection signs: redness spreading beyond wound, warmth appearance, yellow/green discharge, foul smell (ask caregiver)
- Pressure sore staging: Stage 1 (intact skin, redness) / Stage 2 (shallow open wound) / Stage 3 (full thickness) / Stage 4 (exposed muscle/bone)
- Patient relevance: diabetic patients have impaired healing and high infection risk; stroke patients prone to pressure sores; hypertension patients may have poor circulation

For MEDICATION:
- Read ALL visible text: drug name, dosage (mg), frequency, expiry date
- Describe pill appearance: color, shape, size, any imprint/number
- CRITICAL CHECK — compare against patient's medications: ${ctx.medications ?? "not specified"}
  - Does the name match?
  - Does the dosage match?
  - Is it expired?
  - Is it an unfamiliar pill not in the patient's list?
- For unlabeled/unidentified pills: flag as unknown and advise not to administer

For URINE:
- Color scale assessment:
  Pale yellow → Normal, well hydrated
  Dark yellow → Mild dehydration, increase fluids
  Amber/brown → Severe dehydration OR liver concern
  Orange → Possible liver/bile duct issue
  Red/pink → Blood in urine — urgent
  Cloudy/murky → Possible UTI
  Frothy/foamy → Possible kidney issue (especially relevant for diabetics/hypertension)
- Factor in patient's condition: diabetics and hypertension patients have higher kidney/UTI risk

For EYES_FACE:
- Yellow sclera (whites of eyes): jaundice → liver concern, urgent clinic
- Asymmetric facial drooping: possible stroke → A&E immediately
- Swollen face/lips: possible allergic reaction → A&E if breathing affected
- Pale conjunctiva (inner eyelid): possible anaemia

STEP 3 — Respond in EXACTLY this structure:

👁️ KAI Eyes Assessment

🔍 What I see:
[2-3 sentences of clear, objective visual observations. Be specific — size, color, location, any notable features.]

🩺 Clinical interpretation:
[1-2 sentences connecting the visual finding to ${ctx.patientName}'s known condition: ${ctx.condition ?? "chronic illness"}. Mention if their medications or condition increases the risk.]

📊 Triage: [HOME CARE / CLINIC TODAY / GO TO A&E NOW]

[Include the MEDICATION block below IF the image is medication-related, regardless of triage level:]
💊 Medication Check:
• Identified: [drug name and dosage if readable, or "Unable to read label clearly"]
• Match with ${ctx.patientName}'s records: [✅ Correct medication / ⚠️ Mismatch — expected [X] / ❓ Cannot confirm — label unclear]
• Dosage: [value and frequency if visible, or "Not visible"]
• Expiry: [date if visible, or "Not visible"]
• Action: [what the caregiver should do — e.g., "Do not give this pill — it is not on ${ctx.patientName}'s medication list" or "Looks correct, proceed as prescribed"]

[Then ONE triage section:]

--- If HOME CARE ---
✅ What to do now:
• [specific action 1 — reference actual medication/condition if applicable]
• [specific action 2 — wound care, positioning, hydration, etc.]
• [specific action 3]
📸 Track it: Take another photo in 24 hours to monitor for changes.
⏰ Escalate to clinic if: [2 specific warning signs to watch for]

--- If CLINIC TODAY ---
🏥 This needs a doctor's assessment today — not an emergency.
• Tell the doctor: [describe the visual finding + ${ctx.patientName}'s condition + medications in 1-2 sentences]
• Photo tip: Show this photo to the doctor directly.
• While waiting: [1-2 specific home actions]
⚠️ Go to A&E instead if: [2 specific red flags]

--- If GO TO A&E NOW ---
🚨 Go to A&E immediately — do not wait.
📋 Show this to the doctor:
Patient: ${ctx.patientName}, ${ctx.patientAge ?? "elderly"} — ${ctx.condition ?? "chronic condition"} — on ${ctx.medications ?? "regular medications"}
Visual concern: [1 line clinical summary of the finding]
📸 Show this photo to the triage nurse on arrival.
🚗 While travelling: [1 immediate safety action]

⚠️ Disclaimer: KAI Eyes provides visual guidance only — not a clinical diagnosis. Always consult a healthcare professional for definitive assessment.`;

  const response = await ai.generate({
    model: "googleai/gemini-2.5-flash",
    prompt: [
      { media: { url: `data:${mimeType};base64,${imageBase64}` } },
      { text: promptText },
    ],
  });

  let result = response.text ?? "";

  // If Gemini identified a medication, enrich with OpenFDA data + symptom safety analysis
  const identifiedMatch = result.match(/Identified:\s*(.+?)(?:\n|$)/);
  if (identifiedMatch) {
    const identifiedDrug = identifiedMatch[1].trim();
    const [medContext, safetyInsight] = await Promise.all([
      getMedicalContext(identifiedDrug, ctx.medications ?? "", lang),
      ctx.recentSymptoms && ctx.recentSymptoms.length > 0
        ? analyzeMedicationSafety(
            identifiedDrug,
            ctx.recentSymptoms,
            ctx.condition ?? "",
            ctx.medications ?? "",
            ctx.patientName,
            lang
          )
        : Promise.resolve(""),
    ]);
    if (medContext) result += medContext;
    if (safetyInsight) result += safetyInsight;
  }

  return result;
}
