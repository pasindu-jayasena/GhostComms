/**
 * Security role: Freshness tokens for each message.
 * Nonces + timestamps let the server reject replayed ciphertext.
 */

/** 16 random bytes as hex — unique per message. */
export function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** ISO-8601 timestamp for signing and replay window checks. */
export function timestamp() {
  return new Date().toISOString();
}
