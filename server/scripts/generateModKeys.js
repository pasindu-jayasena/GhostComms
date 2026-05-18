/**
 * One-time script: generates moderator RSA-2048 keypair.
 * Put public key in MOD_PUBLIC_KEY; keep private key offline for mod dashboard.
 */
import { generateKeyPairSync } from 'crypto';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

console.log('=== MOD PUBLIC KEY (put in server .env MOD_PUBLIC_KEY) ===\n');
console.log(publicKey);
console.log('\n=== MOD PRIVATE KEY (keep offline — paste in moderator dashboard) ===\n');
console.log(privateKey);
