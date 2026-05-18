import db from '../db.js';

export const Player = {
  create(username, passwordHash, publicKeyPem) {
    const stmt = db.prepare(
      'INSERT INTO players (username, password_hash, public_key_pem) VALUES (?, ?, ?)'
    );
    return stmt.run(username, passwordHash, publicKeyPem);
  },

  findByUsername(username) {
    return db.prepare('SELECT * FROM players WHERE username = ?').get(username);
  },

  getPublicKey(username) {
    const row = db.prepare('SELECT public_key_pem FROM players WHERE username = ?').get(username);
    return row?.public_key_pem || null;
  },

  isBanned(username) {
    const row = db.prepare('SELECT banned FROM players WHERE username = ?').get(username);
    return !!row?.banned;
  },

  setBanned(username, banned) {
    db.prepare('UPDATE players SET banned = ? WHERE username = ?').run(banned ? 1 : 0, username);
  },
};
