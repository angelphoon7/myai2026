import 'dotenv/config';
import * as readline from 'readline';
import { getUser, handleOnboarding } from './onboarding';
import { getAIResponse } from './ai';
import { CHECKIN_QUESTIONS, sendCheckinQuestion, startCheckin } from './checkin';
import { db } from './firebase';

const TEST_PHONE = 'whatsapp:+60123456789';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (prompt: string) => new Promise<string>(resolve => rl.question(prompt, resolve));

function isYes(msg: string) { return /^(yes|y|1)$/i.test(msg.trim()); }
function isNo(msg: string) { return /^(no|n|2)$/i.test(msg.trim()); }

async function processMessage(input: string): Promise<string> {
  const user = await getUser(TEST_PHONE);

  if (!user || !user.onboarded) {
    return handleOnboarding(TEST_PHONE, input);
  }

  if (user.checkinActive && (isYes(input) || isNo(input))) {
    const step = user.checkinStep ?? 0;
    const answer = isYes(input) ? 'YES' : 'NO';
    const questionKey = ['medication', 'meals', 'concerns'][step];
    const today = new Date().toISOString().split('T')[0];

    await db.collection('checkins').doc(`${TEST_PHONE}_${today}`).set(
      { [questionKey]: answer, phone: TEST_PHONE, date: today }, { merge: true }
    );

    const nextStep = step + 1;
    if (nextStep < CHECKIN_QUESTIONS.length) {
      await db.collection('users').doc(TEST_PHONE).update({ checkinStep: nextStep });
      return `[Check-in ${nextStep + 1}/${CHECKIN_QUESTIONS.length}]\n` +
        CHECKIN_QUESTIONS[nextStep].replace('{patient}', user.patientName ?? 'your patient') +
        '\nReply YES or NO';
    } else {
      await db.collection('users').doc(TEST_PHONE).update({ checkinActive: false });
      return `Check-in complete for today. Thank you for caring for ${user.patientName}!`;
    }
  }

  if (input.trim().toLowerCase() === '/checkin') {
    await startCheckin(TEST_PHONE, user.patientName ?? 'your patient');
    const q = CHECKIN_QUESTIONS[0].replace('{patient}', user.patientName ?? 'your patient');
    return `[Check-in 1/${CHECKIN_QUESTIONS.length}]\n${q}\nReply YES or NO`;
  }

  const aiReply = await getAIResponse(input);
  const urgencyMatch = aiReply.match(/Urgency:\s*(\w+)/);
  const urgency = urgencyMatch?.[1] ?? 'Unknown';
  const actionMap: Record<string, string> = {
    Low: 'Monitoring started',
    Medium: 'Teleconsult should be booked',
    Emergency: 'Emergency services should be alerted immediately',
  };
  return `${aiReply}\nSystem Action: ${actionMap[urgency] ?? 'No action'}`;
}

async function main() {
  console.log('\n=== KAI Bot Terminal Test ===');
  console.log('Phone:', TEST_PHONE);
  console.log('Type /checkin to trigger a check-in, /reset to clear profile, /quit to exit\n');

  while (true) {
    const input = await ask('You: ');

    if (input.trim() === '/quit') { rl.close(); process.exit(0); }

    if (input.trim() === '/reset') {
      await db.collection('users').doc(TEST_PHONE).delete();
      console.log('KAI: [Profile reset. Send any message to start onboarding.]\n');
      continue;
    }

    try {
      const reply = await processMessage(input);
      if (reply) console.log(`\nKAI: ${reply}\n`);
    } catch (err: any) {
      console.error('Error:', err.message);
    }
  }
}

main();
