import db from '../db.js';

export const Squad = {
  create(channelId, name, inviteCode, creatorUsername) {
    db.prepare(
      'INSERT INTO squads (channel_id, name, invite_code, creator_username) VALUES (?, ?, ?, ?)'
    ).run(channelId, name, inviteCode, creatorUsername);
    db.prepare(
      'INSERT INTO squad_members (channel_id, username) VALUES (?, ?)'
    ).run(channelId, creatorUsername);
  },

  findByInviteCode(inviteCode) {
    return db.prepare('SELECT * FROM squads WHERE invite_code = ?').get(inviteCode);
  },

  findByChannelId(channelId) {
    return db.prepare('SELECT * FROM squads WHERE channel_id = ?').get(channelId);
  },

  addMember(channelId, username) {
    db.prepare(
      'INSERT OR IGNORE INTO squad_members (channel_id, username) VALUES (?, ?)'
    ).run(channelId, username);
  },

  getMembers(channelId) {
    return db
      .prepare(
        `SELECT sm.username, p.public_key_pem
         FROM squad_members sm
         JOIN players p ON p.username = sm.username
         WHERE sm.channel_id = ?`
      )
      .all(channelId);
  },

  getSquadsForUser(username) {
    return db
      .prepare(
        `SELECT s.channel_id, s.name, s.invite_code,
                (SELECT COUNT(*) FROM squad_members WHERE channel_id = s.channel_id) AS member_count
         FROM squads s
         JOIN squad_members sm ON sm.channel_id = s.channel_id
         WHERE sm.username = ?`
      )
      .all(username);
  },

  saveWrappedKey(channelId, username, encryptedAesKey) {
    db.prepare(
      `INSERT INTO wrapped_keys (channel_id, username, encrypted_aes_key)
       VALUES (?, ?, ?)
       ON CONFLICT(channel_id, username) DO UPDATE SET encrypted_aes_key = excluded.encrypted_aes_key`
    ).run(channelId, username, encryptedAesKey);
  },

  getWrappedKey(channelId, username) {
    return db
      .prepare(
        'SELECT encrypted_aes_key FROM wrapped_keys WHERE channel_id = ? AND username = ?'
      )
      .get(channelId, username);
  },
};
