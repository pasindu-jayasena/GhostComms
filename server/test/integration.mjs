/**
 * Integration tests — run with: node test/integration.mjs (server on :3001)
 */
import 'dotenv/config';
import WebSocket from 'ws';

const API = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001';

const FAKE_PUBKEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtest
-----END PUBLIC KEY-----`;

async function json(path, opts = {}) {
  const { headers, ...rest } = opts;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${path}`);
  return data;
}

async function testHealth() {
  const h = await json('/api/health');
  if (!h.ok) throw new Error('health failed');
  console.log('✓ health');
}

async function testAuthAndSquad() {
  const u1 = `test_${Date.now()}`;
  const u2 = `${u1}_b`;
  await json('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: u1, password: 'pass123', publicKey: FAKE_PUBKEY }),
  });
  const { token } = await json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: u1, password: 'pass123' }),
  });
  const squad = await json('/api/squad/create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Test Squad' }),
  });
  await json('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username: u2, password: 'pass123', publicKey: FAKE_PUBKEY }),
  });
  const { token: token2 } = await json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: u2, password: 'pass123' }),
  });
  await json('/api/squad/join', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token2}` },
    body: JSON.stringify({ inviteCode: squad.inviteCode }),
  });
  const pub = await json(`/api/auth/players/${u1}/pubkey`);
  if (!pub.publicKey) throw new Error('pubkey fetch failed');
  console.log('✓ auth + squad + pubkey');
  return { token, squad };
}

async function testReplay({ token, squad }) {
  const channelId = squad.channelId;
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const ts = new Date().toISOString();
  let replayError = false;

  await new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timer = setTimeout(() => {
      ws.close();
      if (replayError) resolve();
      else reject(new Error('replay not detected'));
    }, 2000);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'JOIN_CHANNEL', channelId, token }));
    });
    ws.on('message', (d) => {
      const msg = JSON.parse(d.toString());
      if (msg.type === 'CHANNEL_JOINED') {
        const envelope = {
          type: 'SEND_MESSAGE',
          messageId: crypto.randomUUID(),
          channelId,
          senderId: 'x',
          timestamp: ts,
          nonce,
          ciphertext: 'YQ==',
          iv: 'YQ==',
          signature: 'YQ==',
        };
        ws.send(JSON.stringify(envelope));
        ws.send(JSON.stringify({ ...envelope, messageId: crypto.randomUUID() }));
      }
      if (msg.type === 'ERROR' && msg.code === 'REPLAY_DETECTED') replayError = true;
    });
    ws.on('error', reject);
  });
  console.log('✓ replay protection');
}

async function testModReports() {
  const reports = await json('/api/mod/reports', {
    headers: { Authorization: `Bearer ${process.env.MOD_API_TOKEN}` },
  });
  if (!Array.isArray(reports.reports)) throw new Error('mod reports failed');
  console.log('✓ mod reports API');
}

async function main() {
  await testHealth();
  const ctx = await testAuthAndSquad();
  await testReplay(ctx);
  await testModReports();
  console.log('\nAll integration tests passed.');
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
