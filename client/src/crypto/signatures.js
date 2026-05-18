/**
 * Security role: Message non-repudiation and anti-impersonation.
 * Signs hash of ciphertext + timestamp + nonce with player's RSA private key.
 */

import { arrayBufferToBase64, base64ToArrayBuffer, importPublicKeyPEM } from './keyManager.js';

function buildSignData(ciphertext, ts, nonce) {
  return new TextEncoder().encode(`${ciphertext}${ts}${nonce}`);
}

export async function signPayload(ciphertext, ts, nonce, privateKey) {
  const data = buildSignData(ciphertext, ts, nonce);
  const sig = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    data
  );
  return arrayBufferToBase64(sig);
}

export async function verifyPayload(ciphertext, ts, nonce, signatureB64, publicKeyPEM) {
  try {
    const pub = await importPublicKeyPEM(publicKeyPEM);
    const data = buildSignData(ciphertext, ts, nonce);
    const sig = base64ToArrayBuffer(signatureB64);
    return await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      pub,
      sig,
      data
    );
  } catch {
    return false;
  }
}
