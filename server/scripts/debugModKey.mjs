import 'dotenv/config';
import { readFileSync } from 'fs';
import { createPublicKey, createPrivateKey } from 'crypto';
import { getModPublicKey } from '../src/crypto/modKeys.js';

const fromEnv = getModPublicKey();
const privPem = readFileSync('mod-private.pem', 'utf8');

try {
  const pubFromPriv = createPublicKey(createPrivateKey(privPem)).export({ type: 'spki', format: 'pem' });
  console.log('Public from private.pem (first 60 chars):', pubFromPriv.slice(0, 60));
  console.log('Match .env?', pubFromPriv.trim() === fromEnv.trim());
} catch (e) {
  console.error('priv error', e.message);
}

try {
  createPublicKey(fromEnv);
  console.log('.env public key: VALID for Node crypto');
} catch (e) {
  console.error('.env public key: INVALID', e.message);
}

console.log('Raw env length', process.env.MOD_PUBLIC_KEY?.length);
console.log('Normalized length', fromEnv?.length);
