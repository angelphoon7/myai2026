"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUser = getUser;
exports.handleOnboarding = handleOnboarding;
const firebase_1 = require("./firebase");
const GREETING = `Hi, I'm KAI 👋 I'll help you monitor your loved one's health from home.\n\nWhat language do you prefer?\n1. English\n2. Bahasa Malaysia`;
const STEPS = {
    en: {
        1: `Great! What is your name?`,
        2: `Who are you caring for?\n\n1. Parent\n2. Spouse\n3. Grandparent\n4. Other`,
        3: `What is the patient's name?`,
        4: `How old is the patient?`,
        5: `What is the main condition?\n\n1. Diabetes\n2. Hypertension\n3. Stroke recovery\n4. Dementia\n5. Other`,
        6: `What medications is the patient currently taking?\nExample: Metformin 500mg, Amlodipine 5mg\n\nOr type "None" to skip.`,
        7: `What time should I check in daily?\nExample: 9am and 6pm`,
        8: `👨‍👩‍👧 Last step — do you have a family member I should alert in emergencies?\n\nWhat is their name? (or type "skip" to finish)`,
        9: `What is their WhatsApp number?\nExample: +60123456789`,
    },
    ms: {
        1: `Baik! Siapa nama anda?`,
        2: `Siapa yang anda jaga?\n\n1. Ibu/Bapa\n2. Pasangan\n3. Datuk/Nenek\n4. Lain-lain`,
        3: `Siapa nama pesakit?`,
        4: `Berapa umur pesakit?`,
        5: `Apakah penyakit utama?\n\n1. Diabetes\n2. Darah Tinggi\n3. Pemulihan Strok\n4. Dementia\n5. Lain-lain`,
        6: `Apakah ubat yang pesakit ambil sekarang?\nContoh: Metformin 500mg, Amlodipine 5mg\n\nAtau taip "Tiada" untuk langkau.`,
        7: `Pukul berapa saya perlu semak setiap hari?\nContoh: 9am dan 6pm`,
        8: `👨‍👩‍👧 Langkah terakhir — ada ahli keluarga yang perlu saya hubungi dalam kecemasan?\n\nSiapa nama mereka? (atau taip "langkau" untuk selesai)`,
        9: `Apakah nombor WhatsApp mereka?\nContoh: +60123456789`,
    },
};
const RELATIONSHIP_MAP = {
    "1": "Parent", "2": "Spouse", "3": "Grandparent", "4": "Other",
};
const CONDITION_MAP = {
    "1": "Diabetes", "2": "Hypertension", "3": "Stroke recovery", "4": "Dementia", "5": "Other",
};
function buildCompletionMessage(profile, lang) {
    const medLine = profile.medications
        ? (lang === "ms" ? `\n💊 Ubat direkodkan: ${profile.medications}` : `\n💊 Medications noted: ${profile.medications}`)
        : "";
    const familyLine = profile.familyName
        ? (lang === "ms" ? `\n👨‍👩‍👧 Kenalan kecemasan: ${profile.familyName}` : `\n👨‍👩‍👧 Emergency contact: ${profile.familyName}`)
        : "";
    return lang === "ms"
        ? `Persediaan selesai, ${profile.caregiverName}! Saya akan mula memantau ${profile.patientName} dari hari ini.${medLine}${familyLine} 💙`
        : `Setup complete, ${profile.caregiverName}! I'll start monitoring ${profile.patientName} from today.${medLine}${familyLine} 💙`;
}
async function getUser(phone) {
    const doc = await firebase_1.db.collection("users").doc(phone).get();
    return doc.exists ? doc.data() : null;
}
async function handleOnboarding(phone, message) {
    let user = await getUser(phone);
    if (!user) {
        await firebase_1.db.collection("users").doc(phone).set({ phone, onboarded: false, step: 1 });
        return GREETING;
    }
    const step = user.step;
    const lang = user.language ?? "en";
    const update = {};
    if (step === 1) {
        update.language = message.trim() === "2" ? "ms" : "en";
        update.step = 2;
        await firebase_1.db.collection("users").doc(phone).update(update);
        return STEPS[update.language][1];
    }
    if (step === 2) {
        update.caregiverName = message.trim();
        update.step = 3;
        await firebase_1.db.collection("users").doc(phone).update(update);
        return STEPS[lang][2];
    }
    if (step === 3) {
        update.relationship = RELATIONSHIP_MAP[message.trim()] ?? message.trim();
        update.step = 4;
        await firebase_1.db.collection("users").doc(phone).update(update);
        return STEPS[lang][3];
    }
    if (step === 4) {
        update.patientName = message.trim();
        update.step = 5;
        await firebase_1.db.collection("users").doc(phone).update(update);
        return STEPS[lang][4];
    }
    if (step === 5) {
        update.patientAge = message.trim();
        update.step = 6;
        await firebase_1.db.collection("users").doc(phone).update(update);
        return STEPS[lang][5];
    }
    if (step === 6) {
        update.mainCondition = CONDITION_MAP[message.trim()] ?? message.trim();
        update.step = 7;
        await firebase_1.db.collection("users").doc(phone).update(update);
        return STEPS[lang][6];
    }
    if (step === 7) {
        const meds = ["none", "tiada"].includes(message.trim().toLowerCase()) ? "" : message.trim();
        update.medications = meds;
        update.step = 8;
        await firebase_1.db.collection("users").doc(phone).update(update);
        return STEPS[lang][7];
    }
    if (step === 8) {
        update.checkInTime = message.trim();
        update.step = 9;
        await firebase_1.db.collection("users").doc(phone).update(update);
        return STEPS[lang][8];
    }
    if (step === 9) {
        const isSkip = ["skip", "langkau"].includes(message.trim().toLowerCase());
        if (isSkip) {
            update.onboarded = true;
            await firebase_1.db.collection("users").doc(phone).update(update);
            return buildCompletionMessage({ ...user, ...update }, lang);
        }
        update.familyName = message.trim();
        update.step = 10;
        await firebase_1.db.collection("users").doc(phone).update(update);
        return STEPS[lang][9];
    }
    if (step === 10) {
        update.familyPhone = message.trim().replace(/\s+/g, "");
        update.onboarded = true;
        await firebase_1.db.collection("users").doc(phone).update(update);
        return buildCompletionMessage({ ...user, ...update }, lang);
    }
    return "";
}
