/**
 * Security role: Decrypt moderator reports (same logic as client modReporting.js).
 */
export {
  decryptModeratorPayload as decryptReportPayload,
  normalizeModPrivateKeyPem,
  verifyModPrivateKey,
} from '@client/crypto/modReporting.js';
