const FDA_BASE = "https://api.fda.gov";

type Lang = "en" | "ms";

export interface DrugLookupResult {
  genericName: string;
  brandNames: string[];
  drugClass: string;
  warning: string;
  recall: RecallResult | null;
}

export interface RecallResult {
  classification: string;
  reason: string;
  date: string;
}

export interface InteractionWarning {
  drugs: string;
  description: string;
  severity: string;
}

async function safeFetch(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function extractDrugName(raw: string): string {
  // Strip dosage: "Metformin 500mg" → "Metformin"
  return raw.trim().split(/\s+/)[0];
}

export function parseMedicationList(medications: string): string[] {
  return medications
    .split(/,|;|\n/)
    .map(m => extractDrugName(m.trim()))
    .filter(m => m.length > 2);
}

// OpenFDA — drug label lookup (warnings, drug class, brand names)
export async function lookupDrug(drugName: string): Promise<DrugLookupResult | null> {
  const name = extractDrugName(drugName).toLowerCase();
  const enc = encodeURIComponent(name);

  const [labelData, recallData] = await Promise.all([
    safeFetch(`${FDA_BASE}/drug/label.json?search=openfda.generic_name:"${enc}"&limit=1`),
    safeFetch(`${FDA_BASE}/drug/enforcement.json?search=product_description:"${enc}"+AND+status:"Ongoing"&limit=1`),
  ]);

  const label = labelData?.results?.[0];
  if (!label) return null;

  const recallRaw = recallData?.results?.[0];
  const recall: RecallResult | null = recallRaw ? {
    classification: recallRaw.classification ?? "Unknown",
    reason: (recallRaw.reason_for_recall ?? "").substring(0, 160),
    date: recallRaw.recall_initiation_date ?? "",
  } : null;

  return {
    genericName: label.openfda?.generic_name?.[0] ?? drugName,
    brandNames: (label.openfda?.brand_name ?? []).slice(0, 3),
    drugClass: label.openfda?.pharm_class_epc?.[0] ?? "",
    warning: (label.warnings?.[0] ?? label.warnings_and_cautions?.[0] ?? "").substring(0, 200),
    recall,
  };
}

// OpenFDA — cross-check each drug's label "drug_interactions" section against the full med list
export async function checkDrugInteractions(medications: string): Promise<InteractionWarning[]> {
  const names = parseMedicationList(medications);
  if (names.length < 2) return [];

  const warnings: InteractionWarning[] = [];

  await Promise.all(
    names.map(async (drugName) => {
      const enc = encodeURIComponent(drugName.toLowerCase());
      const data = await safeFetch(
        `${FDA_BASE}/drug/label.json?search=openfda.generic_name:"${enc}"&limit=1`
      );
      const label = data?.results?.[0];
      if (!label?.drug_interactions) return;

      const interactionText: string = Array.isArray(label.drug_interactions)
        ? label.drug_interactions.join(" ")
        : label.drug_interactions;

      // Check if any OTHER drug in the list is mentioned in this drug's interaction warnings
      const otherDrugs = names.filter(n => n.toLowerCase() !== drugName.toLowerCase());
      for (const other of otherDrugs) {
        if (interactionText.toLowerCase().includes(other.toLowerCase())) {
          const snippet = extractInteractionSnippet(interactionText, other);
          warnings.push({
            drugs: `${drugName} + ${other}`,
            description: snippet,
            severity: inferSeverity(snippet),
          });
        }
      }
    })
  );

  // Deduplicate (A+B and B+A are the same pair) and sort by severity
  const seen = new Set<string>();
  const severityOrder: Record<string, number> = { high: 3, moderate: 2, low: 1, unknown: 0 };
  return warnings
    .filter(w => {
      const key = w.drugs.split(" + ").sort().join("+");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0))
    .slice(0, 3);
}

function extractInteractionSnippet(text: string, drugName: string): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(drugName.toLowerCase());
  if (idx === -1) return text.substring(0, 120);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + 120);
  return "..." + text.substring(start, end).replace(/\s+/g, " ").trim() + "...";
}

function inferSeverity(text: string): string {
  const lower = text.toLowerCase();
  if (/fatal|life.threat|hemorrhag|bleed|severe|contraindic/i.test(lower)) return "high";
  if (/increas|decreas|monitor|adjust|caution|avoid/i.test(lower)) return "moderate";
  return "low";
}

// Format OpenFDA result for WhatsApp message
export function formatDrugInfo(drug: DrugLookupResult, lang: Lang = "en"): string {
  const lines: string[] = [];

  if (drug.recall) {
    lines.push(
      lang === "ms"
        ? `🚨 AMARAN PENARIKAN BALIK (${drug.recall.classification})\n   Sebab: ${drug.recall.reason}\n   Tarikh: ${drug.recall.date}`
        : `🚨 ACTIVE RECALL (${drug.recall.classification})\n   Reason: ${drug.recall.reason}\n   Date: ${drug.recall.date}`
    );
  }

  if (drug.drugClass) {
    lines.push(
      lang === "ms" ? `💊 Kelas ubat: ${drug.drugClass}` : `💊 Drug class: ${drug.drugClass}`
    );
  }

  if (drug.warning) {
    lines.push(
      lang === "ms" ? `⚠️ Amaran FDA: ${drug.warning}` : `⚠️ FDA warning: ${drug.warning}`
    );
  }

  if (lines.length === 0) return "";

  const header =
    lang === "ms"
      ? `\n\n📋 Maklumat Disahkan FDA (OpenFDA):`
      : `\n\n📋 FDA-Verified Drug Info (OpenFDA):`;

  return `${header}\n${lines.join("\n")}`;
}

// Format RxNav interaction warnings for WhatsApp message
export function formatInteractionWarnings(
  warnings: InteractionWarning[],
  lang: Lang = "en"
): string {
  if (warnings.length === 0) return "";

  const header =
    lang === "ms"
      ? `\n\n⚠️ Interaksi Ubat Dikesan (sumber: RxNorm / NLM):`
      : `\n\n⚠️ Drug Interactions Found (source: RxNorm / NLM):`;

  const lines = warnings.map(w => {
    const badge =
      w.severity === "high"
        ? "🔴"
        : w.severity === "moderate"
        ? "🟡"
        : "🟠";
    return `${badge} ${w.drugs}:\n   ${w.description}`;
  });

  return `${header}\n${lines.join("\n")}`;
}

// Safe combined lookup: drug info + interactions, never throws
export async function getMedicalContext(
  identifiedDrug: string,
  allMedications: string,
  lang: Lang = "en"
): Promise<string> {
  const [drug, interactions] = await Promise.all([
    lookupDrug(identifiedDrug),
    allMedications ? checkDrugInteractions(allMedications) : Promise.resolve([]),
  ]);

  const drugBlock = drug ? formatDrugInfo(drug, lang) : "";
  const interactionBlock = formatInteractionWarnings(interactions, lang);

  return `${drugBlock}${interactionBlock}`;
}
