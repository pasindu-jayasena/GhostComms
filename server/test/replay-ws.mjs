/**
 * WebSocket replay protection smoke test (server must be running).
 */
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const WS_URL = 'ws://localhost:3001';
const token = jwt.sign({ username: 'replay_test' }, process.env.JWT_SECRET);
const channelId = 'test-channel';
const nonce = 'abc123nonce4567890abcdef1234567890';
const ts = new Date().toISOString();

const msg = {
  type: 'SEND_MESSAGE',
  messageId: crypto.randomUUID(),
  channelId,
  senderId: 'replay_test',
  timestamp: ts,
  nonce,
  ciphertext: 'dGVzdA==',
  iv: 'dGVzdA==',
  signature: 'dGVzdA==',
};

const ws = new WebSocket(WS_URL);
let errors = 0;

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'JOIN_CHANNEL', channelId, token }));
  setTimeout(() => {
    ws.send(JSON.stringify(msg));
    ws.send(JSON.stringify({ ...msg, messageId: crypto.randomUUID() }));
    setTimeout(() => {
      console.log(errors >= 1 ? 'PASS: replay rejected' : 'FAIL: expected replay error');
      ws.close();
      process.exit(errors >= 1 ? 0 : 1);
    }, 500);
  }, 300);
});

ws.on('message', (data) => {
  const p = JSON.parse(data.toString());
  if (p.type === 'ERROR' && p.code === 'REPLAY_DETECTED') errors++;
});
