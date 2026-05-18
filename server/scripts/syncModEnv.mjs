/**
 * Writes MOD_PUBLIC_KEY to .env from mod-private.pem (matching pair).
 */
import { readFileSync, readFileSync as r, writeFileSync } from 'fs';
import { createPrivateKey, createPublicKey } from 'crypto';

const privPem = readFileSync('mod-private.pem', 'utf8');
const pubPem = createPublicKey(createPrivateKey(privPem)).export({ type: 'spki', format: 'pem' });
const oneLine = pubPem.trim().replace(/\r?\n/g, '\\n');

let env = readFileSync('.env', 'utf8');
if (/^MOD_PUBLIC_KEY=.*$/m.test(env)) {
  env = env.replace(/^MOD_PUBLIC_KEY=.*$/m, `MOD_PUBLIC_KEY="${oneLine}"`);
} else {
  env += `\nMOD_PUBLIC_KEY="${oneLine}"\n`;
}
writeFileSync('.env', env);
console.log('Updated .env MOD_PUBLIC_KEY from mod-private.pem');
console.log(pubPem);
