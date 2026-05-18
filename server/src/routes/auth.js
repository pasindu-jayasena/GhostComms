/**
 * Security role: Player registration/login and public key directory.
 */
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Player } from '../models/Player.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

function issueToken(username) {
  return jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '24h' });
}

router.post('/register', async (req, res) => {
  try {
    const { username, password, publicKey } = req.body;
    if (!username || !password || !publicKey) {
      return res.status(400).json({ error: 'username, password, and publicKey required' });
    }
    if (Player.findByUsername(username)) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    const hash = await bcrypt.hash(password, 10);
    Player.create(username, hash, publicKey);
    const token = issueToken(username);
    res.json({ token, username });
  } catch (err) {
    console.error('[auth register]', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const player = Player.findByUsername(username);
    if (!player) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, player.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (Player.isBanned(username)) {
      return res.status(403).json({ error: 'Account banned from chat', code: 'BANNED' });
    }
    const token = issueToken(username);
    res.json({ token, username });
  } catch (err) {
    console.error('[auth login]', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ username: req.user.username, banned: Player.isBanned(req.user.username) });
});

router.get('/players/:username/pubkey', (req, res) => {
  const pem = Player.getPublicKey(req.params.username);
  if (!pem) return res.status(404).json({ error: 'Player not found' });
  res.json({ username: req.params.username, publicKey: pem });
});

export default router;

// Alias per API spec: GET /api/players/:username/pubkey
export const playersPubkeyRouter = Router();
playersPubkeyRouter.get('/:username/pubkey', (req, res) => {
  const pem = Player.getPublicKey(req.params.username);
  if (!pem) return res.status(404).json({ error: 'Player not found' });
  res.json({ username: req.params.username, publicKey: pem });
});
