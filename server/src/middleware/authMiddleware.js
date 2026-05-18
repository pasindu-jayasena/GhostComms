/**
 * Security role: Ensure only authenticated players access protected APIs.
 */
import jwt from 'jsonwebtoken';
import { Player } from '../models/Player.js';

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function rejectIfBanned(req, res, next) {
  if (Player.isBanned(req.user.username)) {
    return res.status(403).json({ error: 'Account banned from chat', code: 'BANNED' });
  }
  next();
}

export function modAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing moderator token' });
  }
  const token = header.slice(7);
  if (token !== process.env.MOD_API_TOKEN) {
    return res.status(403).json({ error: 'Invalid moderator token' });
  }
  next();
}
