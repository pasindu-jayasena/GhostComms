/**
 * Security role: User-initiated moderator report with client-side re-encryption.
 */
export default function ReportModal({ open, onClose, onConfirm }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h3>Report this message?</h3>
        <p>This message will be encrypted and sent to moderators only.</p>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm}>
            Confirm Report
          </button>
        </div>
      </div>
    </div>
  );
}
