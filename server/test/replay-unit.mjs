import { checkReplay } from '../src/middleware/replayProtection.js';

const nonce = 'testnonce123456789012345678901234';
const ts = new Date().toISOString();

const first = checkReplay(nonce, ts);
const second = checkReplay(nonce, ts);

if (first.ok && !second.ok && second.code === 'REPLAY_DETECTED') {
  console.log('PASS: replay protection');
  process.exit(0);
}
console.log('FAIL', { first, second });
process.exit(1);
