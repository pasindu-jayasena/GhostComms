/**
 * Security role: Visual trust indicator for signature verification result.
 */
export default function VerificationBadge({ verified }) {
  if (verified) {
    return (
      <span className="verify-badge verified" title="Signature verified">
        ✅ Verified
      </span>
    );
  }
  return (
    <span className="verify-badge unverified" title="Signature could not be verified">
      ⚠️ Unverified
    </span>
  );
}
