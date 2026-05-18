/**
 * Security role: GhostComms API entry — routes and WebSocket; never decrypts chat.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import authRoutes, { playersPubkeyRouter } from './routes/auth.js';
import squadRoutes from './routes/squad.js';
import reportRoutes, { modRouter } from './routes/report.js';
import { getModPublicKey } from './crypto/modKeys.js';
import { attachWebSocket } from './websocket/wsServer.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(
  cors({
    origin: [process.env.CLIENT_ORIGIN || 'http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/config/mod-pubkey', (_req, res) => {
  const publicKey = getModPublicKey();
  if (!publicKey) return res.status(503).json({ error: 'Moderator public key not configured' });
  res.json({ publicKey });
});

app.use('/api/auth', authRoutes);
app.use('/api/players', playersPubkeyRouter);
app.use('/api/squad', squadRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/mod', modRouter);

const server = http.createServer(app);
attachWebSocket(server);

server.listen(port, () => {
  console.log(`GhostComms server listening on http://localhost:${port}`);
});
