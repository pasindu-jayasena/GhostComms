/**
 * Smoke tests for GhostComms API (run with server up).
 */
const API = 'http://localhost:3001';

async function main() {
  const health = await fetch(`${API}/api/health`);
  console.log('health', await health.json());

  const modPub = await fetch(`${API}/api/config/mod-pubkey`);
  console.log('mod pubkey', (await modPub.json()).publicKey?.slice(0, 40) + '...');
}

main().catch(console.error);
