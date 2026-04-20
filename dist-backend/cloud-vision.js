"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeWithCloudVision = analyzeWithCloudVision;
exports.buildVisionContext = buildVisionContext;
const google_auth_library_1 = require("google-auth-library");
const VISION_API = 'https://vision.googleapis.com/v1/images:annotate';
let _authClient = null;
async function getAccessToken() {
    if (!_authClient) {
        const auth = new google_auth_library_1.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        _authClient = await auth.getClient();
    }
    const token = await _authClient.getAccessToken();
    if (!token.token)
        throw new Error('Failed to get Cloud Vision access token');
    return token.token;
}
async function analyzeWithCloudVision(base64Image) {
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
    if (!r)
        throw new Error('Cloud Vision returned empty response');
    const fullText = r.fullTextAnnotation?.text ?? r.textAnnotations?.[0]?.description ?? '';
    const labels = (r.labelAnnotations ?? []).map((l) => ({
        name: l.description,
        confidence: Math.round((l.score ?? 0) * 100),
    }));
    const objects = (r.localizedObjectAnnotations ?? []).map((o) => ({
        name: o.name,
        confidence: Math.round((o.score ?? 0) * 100),
    }));
    const ss = r.safeSearchAnnotation ?? {};
    const imageCategory = inferCategory(fullText, labels, objects);
    return { fullText, labels, objects, safeSearch: ss, imageCategory };
}
function inferCategory(text, labels, objects) {
    const allNames = [
        ...labels.map(l => l.name),
        ...objects.map(o => o.name),
    ].join(' ').toLowerCase();
    const textLower = text.toLowerCase();
    // Medication: pill bottle text, drug names, dosage units
    if (/\b(mg|ml|iu|mcg|tablet|capsule|injection|solution|syrup|dose|rx|ndc|lot|exp)\b/.test(textLower) ||
        /\b(pill|tablet|capsule|medication|drug|pharma|sanofi|roche|pfizer|novartis|bayer|merck)\b/.test(allNames))
        return 'MEDICATION';
    // Wound / skin
    if (/\b(wound|injury|skin|rash|sore|bruise|laceration|lesion|cut|burn|blister)\b/.test(allNames))
        return 'WOUND_SKIN';
    // Urine
    if (/\b(urine|toilet|commode|bedpan)\b/.test(allNames))
        return 'URINE';
    // Face / eyes
    if (/\b(face|eye|skin|person|forehead|cheek|nose)\b/.test(allNames))
        return 'EYES_FACE';
    return 'OTHER';
}
function buildVisionContext(result) {
    const lines = [
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
        if (top)
            lines.push(`🏷️ Visual elements: ${top}`);
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
