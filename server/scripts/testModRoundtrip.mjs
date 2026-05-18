/**
 * Verify MOD_PUBLIC_KEY in .env matches mod-private.pem (same roundtrip as browser).
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { getModPublicKey } from '../src/crypto/modKeys.js';
import { webcrypto } from 'crypto';

const subtle = webcrypto.subtle;

function b64(buf) {
  return Buffer.from(buf).toString('base64');
}
function fromB64(s) {
  return Buffer.from(s, 'base64');
}
function pemToBuf(pem, type) {
  const b64 = pem
    .replace(new RegExp(`-----BEGIN ${type}-----`, 'g'), '')
    .replace(new RegExp(`-----END ${type}-----`, 'g'), '')
    .replace(/\s/g, '');
  return fromB64(b64);
}

async function encrypt(plaintext, pubPem) {
  const pub = await subtle.importKey(
    'spki',
    pemToBuf(pubPem, 'PUBLIC KEY'),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt']
  );
  const aes = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const cipher = await subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(plaintext));
  const raw = await subtle.exportKey('raw', aes);
  const wrapped = await subtle.encrypt({ name: 'RSA-OAEP' }, pub, raw);
  return JSON.stringify({
    wrappedKey: b64(wrapped),
    iv: b64(iv),
    ciphertext: b64(cipher),
  });
}

async function decrypt(payloadJson, privPem) {
  const { wrappedKey, iv, ciphertext } = JSON.parse(payloadJson);
  const priv = await subtle.importKey(
    'pkcs8',
    pemToBuf(privPem, 'PRIVATE KEY'),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  );
  const raw = await subtle.decrypt({ name: 'RSA-OAEP' }, priv, fromB64(wrappedKey));
  const aes = await subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['decrypt']);
  const plain = await subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(fromB64(iv)) },
    aes,
    fromB64(ciphertext)
  );
  return new TextDecoder().decode(plain);
}

const pub = getModPublicKey();
const priv = readFileSync(new URL('../mod-private.pem', import.meta.url), 'utf8');
const payload = await encrypt('test message', pub);
const out = await decrypt(payload, priv);
console.log(out === 'test message' ? 'PASS: keys match' : 'FAIL:', out);
// Test with iv.buffer bug
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const badIv = b64(iv.buffer);
console.log('iv length good', new Uint8Array(fromB64(b64(iv))).length, 'bad', new Uint8Array(fromB64(badIv)).length);
