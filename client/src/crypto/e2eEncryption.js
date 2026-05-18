/**
 * Security role: Squad chat confidentiality (AES-256-GCM).
 * Server only ever sees ciphertext; squad key is exchanged via RSA wrap.
 */

import { arrayBufferToBase64, base64ToArrayBuffer } from './keyManager.js';

/** Random AES-256 key for a squad session. */
export async function generateAESKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

/** Encrypt plaintext → { ciphertext, iv } base64. */
export async function encryptMessage(plaintext, aesKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded
  );
  return {
    ciphertext: arrayBufferToBase64(cipherBuf),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

/** Decrypt base64 ciphertext + iv → plaintext string. */
export async function decryptMessage(ciphertextB64, ivB64, aesKey) {
  const cipherBuf = base64ToArrayBuffer(ciphertextB64);
  const iv = new Uint8Array(base64ToArrayBuffer(ivB64));
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    cipherBuf
  );
  return new TextDecoder().decode(plainBuf);
}
