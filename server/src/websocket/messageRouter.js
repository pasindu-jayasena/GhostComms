/**
 * Security role: Route encrypted blobs between squad members without decryption.
 */
import { checkReplay } from '../middleware/replayProtection.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { Squad } from '../models/Squad.js';
import { Player } from '../models/Player.js';

const channels = new Map();
const wsMeta = new WeakMap();

export function getChannelClients(channelId) {
  if (!channels.has(channelId)) channels.set(channelId, new Set());
  return channels.get(channelId);
}

export function setWsMeta(ws, meta) {
  wsMeta.set(ws, meta);
}

export function getWsMeta(ws) {
  return wsMeta.get(ws);
}

function sendBannedError(ws) {
  ws.send(JSON.stringify({ type: 'ERROR', code: 'BANNED', message: 'You are banned from chat' }));
}

export function disconnectUser(username) {
  for (const clients of channels.values()) {
    for (const client of [...clients]) {
      const meta = getWsMeta(client);
      if (meta?.username === username) {
        try {
          client.send(
            JSON.stringify({ type: 'BANNED', message: 'You have been banned from chat' })
          );
        } catch {
          /* socket may already be closing */
        }
        client.close();
        clients.delete(client);
      }
    }
  }
}

function broadcast(channelId, payload, exceptWs = null) {
  const clients = getChannelClients(channelId);
  const data = JSON.stringify(payload);
  for (const client of clients) {
    if (client !== exceptWs && client.readyState === 1) {
      client.send(data);
    }
  }
}

export function handleMessage(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    ws.send(JSON.stringify({ type: 'ERROR', code: 'INVALID_JSON', message: 'Invalid JSON' }));
    return;
  }

  const { type } = msg;

  if (type === 'JOIN_CHANNEL') {
    try {
      const payload = verifyToken(msg.token);
      const { channelId } = msg;
      if (!channelId) {
        ws.send(JSON.stringify({ type: 'ERROR', code: 'MISSING_CHANNEL', message: 'channelId required' }));
        return;
      }
      const squad = Squad.findByChannelId(channelId);
      if (!squad) {
        ws.send(JSON.stringify({ type: 'ERROR', code: 'CHANNEL_NOT_FOUND', message: 'Squad not found' }));
        return;
      }
      const members = Squad.getMembers(channelId);
      if (!members.some((m) => m.username === payload.username)) {
        ws.send(JSON.stringify({ type: 'ERROR', code: 'NOT_MEMBER', message: 'Not a squad member' }));
        return;
      }
      if (Player.isBanned(payload.username)) {
        sendBannedError(ws);
        return;
      }
      setWsMeta(ws, { username: payload.username, channelId });
      getChannelClients(channelId).add(ws);
      const existing = members.filter((m) => m.username !== payload.username);
      ws.send(
        JSON.stringify({
          type: 'CHANNEL_JOINED',
          channelId,
          members: existing.map((m) => ({ username: m.username, pubkey: m.public_key_pem })),
        })
      );
      broadcast(
        channelId,
        { type: 'MEMBER_JOINED', username: payload.username, pubkey: members.find((m) => m.username === payload.username)?.public_key_pem },
        ws
      );
    } catch {
      ws.send(JSON.stringify({ type: 'ERROR', code: 'AUTH_FAILED', message: 'Invalid token' }));
    }
    return;
  }

  const meta = getWsMeta(ws);
  if (!meta?.channelId) {
    ws.send(JSON.stringify({ type: 'ERROR', code: 'NOT_JOINED', message: 'Join a channel first' }));
    return;
  }

  if (Player.isBanned(meta.username)) {
    sendBannedError(ws);
    return;
  }

  if (type === 'SEND_MESSAGE') {
    const replay = checkReplay(msg.nonce, msg.timestamp);
    if (!replay.ok) {
      ws.send(JSON.stringify({ type: 'ERROR', code: replay.code, message: replay.message }));
      return;
    }
    console.log('[ws] message relay', { messageId: msg.messageId, channelId: msg.channelId || meta.channelId });
    const envelope = {
      type: 'MESSAGE',
      messageId: msg.messageId,
      channelId: msg.channelId || meta.channelId,
      senderId: msg.senderId || meta.username,
      timestamp: msg.timestamp,
      nonce: msg.nonce,
      ciphertext: msg.ciphertext,
      iv: msg.iv,
      signature: msg.signature,
    };
    broadcast(meta.channelId, envelope, ws);
    return;
  }

  if (type === 'REQUEST_SQUAD_KEY') {
    broadcast(meta.channelId, {
      type: 'SQUAD_KEY_NEEDED',
      username: meta.username,
    });
    return;
  }

  if (type === 'KEY_EXCHANGE') {
    const { targetPlayer, encryptedAESKey, fromPlayer } = msg;
    const clients = getChannelClients(meta.channelId);
    for (const client of clients) {
      const cm = getWsMeta(client);
      if (cm?.username === targetPlayer) {
        client.send(
          JSON.stringify({
            type: 'KEY_EXCHANGE',
            fromPlayer: fromPlayer || meta.username,
            encryptedAESKey,
          })
        );
        return;
      }
    }
    Squad.saveWrappedKey(meta.channelId, targetPlayer, encryptedAESKey);
    return;
  }

  if (type === 'TYPING') {
    broadcast(meta.channelId, { type: 'TYPING', username: meta.username });
    return;
  }

  ws.send(JSON.stringify({ type: 'ERROR', code: 'UNKNOWN_TYPE', message: 'Unknown message type' }));
}

export function handleDisconnect(ws) {
  const meta = getWsMeta(ws);
  if (meta?.channelId) {
    getChannelClients(meta.channelId).delete(ws);
  }
}
