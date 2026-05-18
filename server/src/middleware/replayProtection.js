/**
 * Security role: Reject replayed WebSocket messages via nonce deduplication.
 * Nonces expire after 5 minutes; timestamps must be within ±2 minutes.
 */

const NONCE_TTL_MS = 5 * 60 * 1000;
const TIMESTAMP_WINDOW_MS = 2 * 60 * 1000;
const seenNonces = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [nonce, expiry] of seenNonces.entries()) {
    if (expiry <= now) seenNonces.delete(nonce);
  }
}, 60 * 1000);

export function checkReplay(nonce, timestampIso) {
  if (!nonce || !timestampIso) {
    return { ok: false, code: 'INVALID_MESSAGE', message: 'Missing nonce or timestamp' };
  }

  const ts = new Date(timestampIso).getTime();
  if (Number.isNaN(ts)) {
    return { ok: false, code: 'INVALID_TIMESTAMP', message: 'Invalid timestamp format' };
  }

  const now = Date.now();
  if (Math.abs(now - ts) > TIMESTAMP_WINDOW_MS) {
    return { ok: false, code: 'TIMESTAMP_OUT_OF_WINDOW', message: 'Timestamp outside allowed window' };
  }

  if (seenNonces.has(nonce)) {
    console.warn('[replay] Duplicate nonce rejected:', nonce.slice(0, 8));
    return { ok: false, code: 'REPLAY_DETECTED', message: 'Duplicate nonce — possible replay attack' };
  }

  seenNonces.set(nonce, now + NONCE_TTL_MS);
  return { ok: true };
}
