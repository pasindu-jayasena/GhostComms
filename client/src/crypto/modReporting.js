/**
 * Security role: Moderator-only report visibility.
 * Hybrid encrypt: AES-256-GCM for message body + RSA-OAEP wrap of AES key.
 * Server cannot read payload; only moderator private key decrypts.
 */

import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  importPublicKeyPEMForOAEP,
  importPrivateKeyPEMForOAEP,
} from './keyManager.js';

/** Normalize pasted PEM (BOM, literal \\n, missing headers). */
export function normalizeModPrivateKeyPem(input) {
  let s = String(input).trim().replace(/^\uFEFF/, '');
  if (s.includes('\\n')) s = s.replace(/\\n/g, '\n');
  if (s.includes('BEGIN PRIVATE KEY')) return s;
  const b64 = s.replace(/\s/g, '');
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`;
}

/** True if private key matches the server's MOD_PUBLIC_KEY. */
export async function verifyModPrivateKey(privatePem, serverPublicPem) {
  try {
    const normalized = normalizeModPrivateKeyPem(privatePem);
    const probe = await encryptForModerator('__ghostcomms_key_check__', serverPublicPem);
    const out = await decryptModeratorPayload(probe, normalized);
    return out === '__ghostcomms_key_check__';
  } catch {
    return false;
  }
}

export async function encryptForModerator(plaintext, modPublicKeyPEM) {
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded
  );
  const rawAes = await crypto.subtle.exportKey('raw', aesKey);
  const modPub = await importPublicKeyPEMForOAEP(modPublicKeyPEM);
  const wrappedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    modPub,
    rawAes
  );
  const ivB64 = arrayBufferToBase64(
    iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength)
  );
  return JSON.stringify({
    wrappedKey: arrayBufferToBase64(wrappedKey),
    iv: ivB64,
    ciphertext: arrayBufferToBase64(cipherBuf),
  });
}

export async function decryptModeratorPayload(payloadJson, modPrivateKeyPEM) {
  const pem = normalizeModPrivateKeyPem(modPrivateKeyPEM);
  const { wrappedKey, iv, ciphertext } = JSON.parse(payloadJson);
  const priv = await importPrivateKeyPEMForOAEP(pem);
  const rawAes = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    priv,
    base64ToArrayBuffer(wrappedKey)
  );
  const aesKey = await crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, true, [
    'decrypt',
  ]);
  const ivBytes = new Uint8Array(base64ToArrayBuffer(iv));
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    aesKey,
    base64ToArrayBuffer(ciphertext)
  );
  return new TextDecoder().decode(plainBuf);
}
