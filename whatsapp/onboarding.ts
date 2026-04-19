import { db } from "./firebase";

export interface UserProfile {
  phone: string;
  caregiverName?: string;
  relationship?: string;
  patientName?: string;
  patientAge?: string;
  mainCondition?: string;
  checkInTime?: string;
  checkinActive?: boolean;
  checkinStep?: number;
  checkinDate?: string;
  awaitingConcernDetail?: boolean;
  onboarded: boolean;
  step: number;
}

const STEPS: Record<number, string> = {
  0: `Hi, I'm KAI. I'll help you monitor and support your loved one at home.\nLet's do a quick setup. What is your name?`,
  1: `Who are you caring for?\n\n1. Parent\n2. Spouse\n3. Grandparent\n4. Other`,
  2: `What is the patient's name?`,
  3: `How old is the patient?`,
  4: `What is the main condition?\n\n1. Diabetes\n2. Hypertension\n3. Stroke recovery\n4. Dementia\n5. Other`,
  5: `What time should I check in daily?\nExample: 9am and 6pm`,
};

const RELATIONSHIP_MAP: Record<string, string> = {
  "1": "Parent", "2": "Spouse", "3": "Grandparent", "4": "Other",
};

const CONDITION_MAP: Record<string, string> = {
  "1": "Diabetes", "2": "Hypertension", "3": "Stroke recovery", "4": "Dementia", "5": "Other",
};

export async function getUser(phone: string): Promise<UserProfile | null> {
  const doc = await db.collection("users").doc(phone).get();
  return doc.exists ? (doc.data() as UserProfile) : null;
}

export async function handleOnboarding(phone: string, message: string): Promise<string> {
  let user = await getUser(phone);

  if (!user) {
    await db.collection("users").doc(phone).set({ phone, onboarded: false, step: 1 });
    return STEPS[0];
  }

  const step = user.step;
  const update: Partial<UserProfile> = {};

  if (step === 1) {
    update.caregiverName = message.trim();
    update.step = 2;
    await db.collection("users").doc(phone).update(update);
    return STEPS[1];
  }

  if (step === 2) {
    update.relationship = RELATIONSHIP_MAP[message.trim()] ?? message.trim();
    update.step = 3;
    await db.collection("users").doc(phone).update(update);
    return STEPS[2];
  }

  if (step === 3) {
    update.patientName = message.trim();
    update.step = 4;
    await db.collection("users").doc(phone).update(update);
    return STEPS[3];
  }

  if (step === 4) {
    update.patientAge = message.trim();
    update.step = 5;
    await db.collection("users").doc(phone).update(update);
    return STEPS[4];
  }

  if (step === 5) {
    update.mainCondition = CONDITION_MAP[message.trim()] ?? message.trim();
    update.step = 6;
    await db.collection("users").doc(phone).update(update);
    return STEPS[5];
  }

  if (step === 6) {
    update.checkInTime = message.trim();
    update.step = 7;
    update.onboarded = true;
    await db.collection("users").doc(phone).update(update);
    const profile = { ...user, ...update };
    return `Setup complete, ${profile.caregiverName}! I'll start monitoring ${profile.patientName} from today.`;
  }

  return "";
}
