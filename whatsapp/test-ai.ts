import 'dotenv/config';
import { getAIResponse } from './ai';

async function main() {
  const testMessage = 'My dad has fever for 3 days and not eating';
  console.log('Testing:', testMessage);
  const reply = await getAIResponse(testMessage);
  console.log('\nKAI reply:\n', reply);
}

main().catch(console.error);
