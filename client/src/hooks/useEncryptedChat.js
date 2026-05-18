/**
 * Security role: Encrypt/sign outbound and verify/decrypt inbound squad messages.
 */
import { useState, useCallback, useRef } from 'react';
import { encryptMessage, decryptMessage } from '../crypto/e2eEncryption.js';
import { signPayload, verifyPayload } from '../crypto/signatures.js';
import { generateNonce, timestamp } from '../crypto/nonce.js';
import { getPrivateSigningKey } from '../crypto/keyManager.js';
import { apiFetch } from '../api.js';

function appendUniqueMessage(prev, entry) {
  if (prev.some((m) => m.id === entry.id)) return prev;
  return [...prev, entry];
}

export function useEncryptedChat({ user, aesKey, channelId, sendWs, isBanned = false }) {
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const pubkeyCache = useRef(new Map());
  const seenIds = useRef(new Set());

  const getSenderPubkey = useCallback(async (username) => {
    if (pubkeyCache.current.has(username)) return pubkeyCache.current.get(username);
    const data = await apiFetch(`/api/players/${username}/pubkey`);
    pubkeyCache.current.set(username, data.publicKey);
    return data.publicKey;
  }, []);

  const handleIncoming = useCallback(
    async (msg) => {
      if (msg.type === 'TYPING') {
        setTypingUser(msg.username);
        setTimeout(() => setTypingUser(null), 2000);
        return;
      }
      if (msg.type === 'MESSAGE') {
        if (!aesKey) return;
        let text = '[Unable to decrypt]';
        let verified = false;
        try {
          text = await decryptMessage(msg.ciphertext, msg.iv, aesKey);
          const pub = await getSenderPubkey(msg.senderId);
          verified = await verifyPayload(
            msg.ciphertext,
            msg.timestamp,
            msg.nonce,
            msg.signature,
            pub
          );
        } catch {
          verified = false;
        }
        const entry = {
          id: msg.messageId,
          senderId: msg.senderId,
          text,
          timestamp: msg.timestamp,
          verified,
          raw: msg,
        };
        if (seenIds.current.has(entry.id)) return;
        seenIds.current.add(entry.id);
        setMessages((prev) => appendUniqueMessage(prev, entry));
      }
    },
    [aesKey, getSenderPubkey]
  );

  const sendMessage = useCallback(
    async (plaintext) => {
      if (isBanned) throw new Error('You are banned from chat');
      if (!aesKey || !channelId || !user) throw new Error('Not ready to send — join squad and wait for encryption key');
      const priv = await getPrivateSigningKey(user.username);
      const nonce = generateNonce();
      const ts = timestamp();
      const { ciphertext, iv } = await encryptMessage(plaintext, aesKey);
      const signature = await signPayload(ciphertext, ts, nonce, priv);
      const messageId = crypto.randomUUID();
      const envelope = {
        type: 'SEND_MESSAGE',
        messageId,
        channelId,
        senderId: user.username,
        timestamp: ts,
        nonce,
        ciphertext,
        iv,
        signature,
      };
      sendWs(envelope);
      const pub = await getSenderPubkey(user.username);
      const verified = await verifyPayload(ciphertext, ts, nonce, signature, pub);
      const entry = {
        id: messageId,
        senderId: user.username,
        text: plaintext,
        timestamp: ts,
        verified,
        raw: envelope,
      };
      seenIds.current.add(messageId);
      setMessages((prev) => appendUniqueMessage(prev, entry));
    },
    [aesKey, channelId, user, sendWs, getSenderPubkey, isBanned]
  );

  const sendTyping = useCallback(() => {
    if (isBanned) return;
    sendWs({ type: 'TYPING' });
  }, [sendWs, isBanned]);

  const clearMessages = useCallback(() => {
    seenIds.current.clear();
    setMessages([]);
  }, []);

  return {
    messages,
    typingUser,
    sendMessage,
    sendTyping,
    handleIncoming,
    clearMessages,
    setMessages,
  };
}
