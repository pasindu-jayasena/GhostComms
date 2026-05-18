/**
 * Security role: Persistent storage for identities and opaque ciphertext blobs.
 * No plaintext messages or private keys are stored.
 * Uses Node built-in node:sqlite (no native addon; works on Node 22.5+).
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'ghostcomms.db');

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    public_key_pem TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS squads (
    channel_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    creator_username TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS squad_members (
    channel_id TEXT NOT NULL,
    username TEXT NOT NULL,
    joined_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (channel_id, username),
    FOREIGN KEY (channel_id) REFERENCES squads(channel_id)
  );

  CREATE TABLE IF NOT EXISTS wrapped_keys (
    channel_id TEXT NOT NULL,
    username TEXT NOT NULL,
    encrypted_aes_key TEXT NOT NULL,
    PRIMARY KEY (channel_id, username)
  );

  CREATE TABLE IF NOT EXISTS reports (
    report_id TEXT PRIMARY KEY,
    reported_by TEXT NOT NULL,
    reported_player TEXT NOT NULL,
    mod_encrypted_payload TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    status TEXT DEFAULT 'pending'
  );
`);

try {
  db.exec(`ALTER TABLE players ADD COLUMN banned INTEGER NOT NULL DEFAULT 0`);
} catch {
  /* column already exists */
}

const bannedFromReports = db
  .prepare(`SELECT DISTINCT reported_player AS username FROM reports WHERE status = 'banned'`)
  .all();
for (const { username } of bannedFromReports) {
  db.prepare('UPDATE players SET banned = 1 WHERE username = ?').run(username);
}

export default db;
