/**
 * Security role: Squad membership and opaque AES key relay (wrapped keys only).
 */
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { authMiddleware, rejectIfBanned } from '../middleware/authMiddleware.js';
import { Squad } from '../models/Squad.js';

const router = Router();

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

router.use(authMiddleware, rejectIfBanned);

router.get('/mine', (req, res) => {
  const squads = Squad.getSquadsForUser(req.user.username);
  res.json({ squads });
});

router.post('/create', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Squad name required' });
  const channelId = randomUUID();
  const inviteCode = generateInviteCode();
  Squad.create(channelId, name, inviteCode, req.user.username);
  res.json({ channelId, name, inviteCode });
});

router.post('/join', (req, res) => {
  const inviteCode = String(req.body.inviteCode || '').trim().toUpperCase();
  if (!inviteCode) return res.status(400).json({ error: 'Invite code required' });
  const squad = Squad.findByInviteCode(inviteCode);
  if (!squad) return res.status(404).json({ error: 'Invalid invite code' });
  Squad.addMember(squad.channel_id, req.user.username);
  res.json({
    channelId: squad.channel_id,
    name: squad.name,
    inviteCode: squad.invite_code,
  });
});

router.get('/:channelId/members', (req, res) => {
  const squad = Squad.findByChannelId(req.params.channelId);
  if (!squad) return res.status(404).json({ error: 'Squad not found' });
  const members = Squad.getMembers(req.params.channelId);
  res.json({ members });
});

router.post('/:channelId/wrapped-key', (req, res) => {
  const { username, encryptedAESKey } = req.body;
  if (!username || !encryptedAESKey) {
    return res.status(400).json({ error: 'username and encryptedAESKey required' });
  }
  Squad.saveWrappedKey(req.params.channelId, username, encryptedAESKey);
  res.json({ ok: true });
});

router.get('/:channelId/wrapped-key', (req, res) => {
  const row = Squad.getWrappedKey(req.params.channelId, req.user.username);
  // 200 + null avoids browser 404 spam while joiner waits for key distribution
  res.json({ encryptedAESKey: row?.encrypted_aes_key ?? null });
});

export default router;
