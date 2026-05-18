/**
 * Security role: Store moderator-encrypted reports (server cannot decrypt).
 */
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { authMiddleware, modAuthMiddleware, rejectIfBanned } from '../middleware/authMiddleware.js';
import { Report } from '../models/Report.js';
import { Player } from '../models/Player.js';
import { disconnectUser } from '../websocket/messageRouter.js';

const router = Router();

router.post('/', authMiddleware, rejectIfBanned, (req, res) => {
  try {
    const { reportedPlayer, modEncryptedPayload } = req.body;
    if (!reportedPlayer || !modEncryptedPayload) {
      return res.status(400).json({ error: 'reportedPlayer and modEncryptedPayload required' });
    }
    const reportId = randomUUID();
    const ts = new Date().toISOString();
    Report.create(reportId, req.user.username, reportedPlayer, modEncryptedPayload, ts);
    res.json({ reportId, ok: true });
  } catch (err) {
    console.error('[report]', err.message);
    res.status(500).json({ error: 'Failed to store report' });
  }
});

export const modRouter = Router();

modRouter.get('/reports', modAuthMiddleware, (req, res) => {
  const reports = Report.getAll();
  res.json({ reports });
});

modRouter.patch('/reports/:reportId', modAuthMiddleware, (req, res) => {
  const { status } = req.body;
  if (!['dismissed', 'banned', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const report = Report.findById(req.params.reportId);
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }
  if (status === 'banned' && report.reported_player) {
    Player.setBanned(report.reported_player, true);
    disconnectUser(report.reported_player);
  }
  Report.updateStatus(req.params.reportId, status);
  res.json({ ok: true });
});

export default router;
