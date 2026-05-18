import db from '../db.js';

export const Report = {
  create(reportId, reportedBy, reportedPlayer, modEncryptedPayload, ts) {
    db.prepare(
      `INSERT INTO reports (report_id, reported_by, reported_player, mod_encrypted_payload, timestamp)
       VALUES (?, ?, ?, ?, ?)`
    ).run(reportId, reportedBy, reportedPlayer, modEncryptedPayload, ts);
  },

  getAll() {
    return db
      .prepare(
        `SELECT report_id, reported_by, reported_player, mod_encrypted_payload, timestamp, status
         FROM reports ORDER BY timestamp DESC`
      )
      .all();
  },

  findById(reportId) {
    return db
      .prepare(
        `SELECT report_id, reported_by, reported_player, mod_encrypted_payload, timestamp, status
         FROM reports WHERE report_id = ?`
      )
      .get(reportId);
  },

  updateStatus(reportId, status) {
    db.prepare('UPDATE reports SET status = ? WHERE report_id = ?').run(status, reportId);
  },
};
