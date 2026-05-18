/**
 * Security role: Player identity keys (RSA-2048).
 * Private keys never leave the browser (IndexedDB); public keys register with server.
 * One keypair used for message signing and squad AES key wrap (RSA-OAEP).
 */

const DB_NAME = 'ghostcomms_keys';
const DB_VERSION = 1;
const STORE = 'keys';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'username' });
      }
    };
  });
}

async function saveKeys(username, publicJwk, privateJwk) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ username, publicJwk, privateJwk });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadKeys(username) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(username);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function pemToSpkiBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s/g, '');
  return base64ToArrayBuffer(b64);
}

function pemToPkcs8Buffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  return base64ToArrayBuffer(b64);
}

/** Generate RSA-2048 keypair for signing and key wrap. */
export async function generateRSAKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );
}

export async function exportPublicKeyPEM(publicKey) {
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  const b64 = arrayBufferToBase64(spki);
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}

export async function importPublicKeyPEM(pem) {
  return crypto.subtle.importKey(
    'spki',
    pemToSpkiBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['verify']
  );
}

export async function importPublicKeyPEMForOAEP(pem) {
  return crypto.subtle.importKey(
    'spki',
    pemToSpkiBuffer(pem),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt']
  );
}

export async function importPrivateKeyPEMForOAEP(pem) {
  return crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8Buffer(pem),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['decrypt']
  );
}

export async function storePlayerKeys(username, keyPair) {
  const [publicJwk, privateJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', keyPair.publicKey),
    crypto.subtle.exportKey('jwk', keyPair.privateKey),
  ]);
  await saveKeys(username, publicJwk, privateJwk);
}

export async function getRegistrationPublicKeyPEM(username) {
  const stored = await loadKeys(username);
  if (!stored) throw new Error('No keys found for this user. Please register again.');
  const pub = await crypto.subtle.importKey(
    'jwk',
    stored.publicJwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['verify']
  );
  return exportPublicKeyPEM(pub);
}

export async function getPrivateSigningKey(username) {
  const stored = await loadKeys(username);
  if (!stored) throw new Error('No signing key found.');
  return crypto.subtle.importKey(
    'jwk',
    stored.privateJwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['sign']
  );
}

export async function getPrivateOAEPKey(username) {
  const stored = await loadKeys(username);
  if (!stored) throw new Error('No encryption key found.');
  const pem = await exportPrivateKeyPEMFromJwk(stored.privateJwk);
  return importPrivateKeyPEMForOAEP(pem);
}

async function exportPrivateKeyPEMFromJwk(privateJwk) {
  const priv = await crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true,
    ['sign']
  );
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', priv);
  const b64 = arrayBufferToBase64(pkcs8);
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`;
}

export async function wrapAESKeyForMember(aesCryptoKey, memberPublicKeyPEM) {
  const raw = await crypto.subtle.exportKey('raw', aesCryptoKey);
  const pubKey = await importPublicKeyPEMForOAEP(memberPublicKeyPEM);
  const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pubKey, raw);
  return arrayBufferToBase64(wrapped);
}

export async function unwrapAESKey(encryptedB64, username) {
  const priv = await getPrivateOAEPKey(username);
  const wrapped = base64ToArrayBuffer(encryptedB64);
  const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, priv, wrapped);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function hasKeys(username) {
  const stored = await loadKeys(username);
  return !!stored;
}
