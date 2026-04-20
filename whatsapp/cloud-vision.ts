import { GoogleAuth } from 'google-auth-library';

const VISION_API = 'https://vision.googleapis.com/v1/images:annotate';

export interface CloudVisionResult {
  fullText: string;
  labels: { name: string; confidence: number }[];
  objects: { name: string; confidence: number }[];
  safeSearch: { adult: string; medical: string; violence: string };
  imageCategory: 'MEDICATION' | 'WOUND_SKIN' | 'URINE' | 'EYES_FACE' | 'OTHER';
}

let _authClient: any = null;

async function getAccessToken(): Promise<string> {
  if (!_authClient) {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    _authClient = await auth.getClient();
  }
  const token = await _authClient.getAccessToken();
  if (!token.token) throw new Error('Failed to get Cloud Vision access token');
  return token.token;
}

export async function analyzeWithCloudVision(base64Image: string): Promise<CloudVisionResult> {
  const token = await getAccessToken();

  const res = await fetch(VISION_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64Image },
          features: [
            { type: 'TEXT_DETECTION', maxResults: 50 },
            { type: 'LABEL_DETECTION', maxResults: 15 },
            { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
            { type: 'SAFE_SEARCH_DETECTION' },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Cloud Vision API error ${res.status}: ${body.substring(0, 120)}`);
  }

  const data = await res.json();
  const r = data.responses?.[0];
  if (!r) throw new Error('Cloud Vision returned empty response');

  const fullText: string = r.fullTextAnnotation?.text ?? r.textAnnotations?.[0]?.description ?? '';
  const labels: { name: string; confidence: number }[] = (r.labelAnnotations ?? []).map((l: any) => ({
    name: l.description as string,
    confidence: Math.round((l.score ?? 0) * 100),
  }));
  const objects: { name: string; confidence: number }[] = (r.localizedObjectAnnotations ?? []).map((o: any) => ({
    name: o.name as string,
    confidence: Math.round((o.score ?? 0) * 100),
  }));
  const ss = r.safeSearchAnnotation ?? {};

  const imageCategory = inferCategory(fullText, labels, objects);

  return { fullText, labels, objects, safeSearch: ss, imageCategory };
}

function inferCategory(
  text: string,
  labels: { name: string }[],
  objects: { name: string }[]
): CloudVisionResult['imageCategory'] {
  const allNames = [
    ...labels.map(l => l.name),
    ...objects.map(o => o.name),
  ].join(' ').toLowerCase();

  const textLower = text.toLowerCase();

  // Medication: pill bottle text, drug names, dosage units
  if (
    /\b(mg|ml|iu|mcg|tablet|capsule|injection|solution|syrup|dose|rx|ndc|lot|exp)\b/.test(textLower) ||
    /\b(pill|tablet|capsule|medication|drug|pharma|sanofi|roche|pfizer|novartis|bayer|merck)\b/.test(allNames)
  ) return 'MEDICATION';

  // Wound / skin
  if (/\b(wound|injury|skin|rash|sore|bruise|laceration|lesion|cut|burn|blister)\b/.test(allNames))
    return 'WOUND_SKIN';

  // Urine
  if (/\b(urine|toilet|commode|bedpan)\b/.test(allNames)) return 'URINE';

  // Face / eyes
  if (/\b(face|eye|skin|person|forehead|cheek|nose)\b/.test(allNames)) return 'EYES_FACE';

  return 'OTHER';
}

export function buildVisionContext(result: CloudVisionResult): string {
  const lines: string[] = [
    '════ GOOGLE CLOUD VISION (verified machine data) ════',
  ];

  if (result.imageCategory !== 'OTHER') {
    lines.push(`📌 Detected image type: ${result.imageCategory}`);
  }

  if (result.fullText) {
    const cleanText = result.fullText.replace(/\n+/g, ' ').trim().substring(0, 600);
    lines.push(`📝 Text extracted (OCR):\n${cleanText}`);
  }

  if (result.labels.length > 0) {
    const top = result.labels
      .filter(l => l.confidence >= 60)
      .slice(0, 8)
      .map(l => `${l.name} ${l.confidence}%`)
      .join(', ');
    if (top) lines.push(`🏷️ Visual elements: ${top}`);
  }

  if (result.objects.length > 0) {
    const objs = result.objects
      .map(o => `${o.name} ${o.confidence}%`)
      .join(', ');
    lines.push(`📦 Detected objects: ${objs}`);
  }

  lines.push('════════════════════════════════════════════════');
  return lines.join('\n');
}
