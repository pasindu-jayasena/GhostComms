/**
 * Security role: Moderator public key distribution (never the private key).
 */

/** Normalize MOD_PUBLIC_KEY from .env (PEM or raw base64) to full PEM. */
export function getModPublicKey() {
  let key = process.env.MOD_PUBLIC_KEY?.trim();
  if (!key) return null;
  key = key.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '');
  if (!key.includes('BEGIN PUBLIC KEY')) {
    const b64 = key.replace(/\s/g, '');
    const lines = b64.match(/.{1,64}/g) || [];
    key = `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
  }
  return key;
}
