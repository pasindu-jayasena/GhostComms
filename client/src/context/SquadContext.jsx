/**
 * Security role: Squad session AES key in memory only (never sent plaintext to server).
 */
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { apiFetch, apiFetchOptional, authHeaders, fetchModPublicKey } from '../api.js';
import { useAuth } from './AuthContext.jsx';
import { generateAESKey } from '../crypto/e2eEncryption.js';
import { wrapAESKeyForMember, unwrapAESKey } from '../crypto/keyManager.js';

const SquadContext = createContext(null);

export function SquadProvider({ children }) {
  const { user, authHeaders: ah } = useAuth();
  const [squads, setSquads] = useState([]);
  const [activeSquad, setActiveSquad] = useState(null);
  const [aesKey, setAesKey] = useState(null);
  const [keyError, setKeyError] = useState(null);
  const [modPublicKey, setModPublicKey] = useState(null);
  const aesKeyRef = useRef(null);

  useEffect(() => {
    aesKeyRef.current = aesKey;
  }, [aesKey]);

  const refreshSquads = useCallback(async () => {
    if (!user) return;
    const data = await apiFetch('/api/squad/mine', { headers: ah(user.token) });
    setSquads(data.squads || []);
  }, [user, ah]);

  const loadModKey = useCallback(async () => {
    const { publicKey } = await fetchModPublicKey();
    setModPublicKey(publicKey);
  }, []);

  const tryLoadWrappedKey = useCallback(
    async (channelId) => {
      setKeyError(null);
      const wrapped = await apiFetchOptional(`/api/squad/${channelId}/wrapped-key`, {
        headers: ah(user.token),
      });
      if (!wrapped?.encryptedAESKey) return false;
      try {
        const key = await unwrapAESKey(wrapped.encryptedAESKey, user.username);
        setAesKey(key);
        aesKeyRef.current = key;
        return true;
      } catch (err) {
        setKeyError(
          'Could not unlock squad key with your RSA private key. Register again on this browser (new keys).'
        );
        return false;
      }
    },
    [user, ah]
  );

  const createSquad = useCallback(
    async (name) => {
      const data = await apiFetch('/api/squad/create', {
        method: 'POST',
        headers: ah(user.token),
        body: JSON.stringify({ name }),
      });
      const key = await generateAESKey();
      const squad = { ...data, channel_id: data.channelId, channelId: data.channelId };
      setAesKey(key);
      aesKeyRef.current = key;
      setActiveSquad(squad);
      setKeyError(null);
      await refreshSquads();
      return { ...squad, squadAesKey: key };
    },
    [user, ah, refreshSquads]
  );

  const joinSquad = useCallback(
    async (inviteCode) => {
      const data = await apiFetch('/api/squad/join', {
        method: 'POST',
        headers: ah(user.token),
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
      });
      const squad = { ...data, channel_id: data.channelId, channelId: data.channelId };
      setActiveSquad(squad);
      setAesKey(null);
      aesKeyRef.current = null;
      setKeyError(null);
      await refreshSquads();
      await tryLoadWrappedKey(data.channelId);
      return squad;
    },
    [user, ah, refreshSquads, tryLoadWrappedKey]
  );

  const selectSquad = useCallback(
    async (squad, options = {}) => {
      const id = squad.channel_id || squad.channelId;
      const squadNorm = { ...squad, channel_id: id, channelId: id };
      setActiveSquad(squadNorm);
      setKeyError(null);

      if (options.squadAesKey) {
        setAesKey(options.squadAesKey);
        aesKeyRef.current = options.squadAesKey;
        return;
      }

      if (options.preserveKey && aesKeyRef.current) {
        setAesKey(aesKeyRef.current);
        return;
      }

      setAesKey(null);
      aesKeyRef.current = null;
      await tryLoadWrappedKey(id);
    },
    [tryLoadWrappedKey]
  );

  const distributeKeyToMember = useCallback(
    async (channelId, memberUsername, memberPubkey, squadAesKey, sendWs) => {
      if (!memberPubkey) throw new Error(`No public key for ${memberUsername}`);
      const wrapped = await wrapAESKeyForMember(squadAesKey, memberPubkey);
      await apiFetch(`/api/squad/${channelId}/wrapped-key`, {
        method: 'POST',
        headers: ah(user.token),
        body: JSON.stringify({ username: memberUsername, encryptedAESKey: wrapped }),
      });
      if (sendWs) {
        sendWs({
          type: 'KEY_EXCHANGE',
          targetPlayer: memberUsername,
          encryptedAESKey: wrapped,
          fromPlayer: user.username,
        });
      }
    },
    [user, ah]
  );

  const distributeToAllMembers = useCallback(
    async (channelId, sendWs, onlyUsername = null) => {
      const key = aesKeyRef.current;
      if (!key) return;
      const data = await apiFetch(`/api/squad/${channelId}/members`, {
        headers: ah(user.token),
      });
      for (const m of data.members || []) {
        if (m.username === user.username) continue;
        if (onlyUsername && m.username !== onlyUsername) continue;
        try {
          await distributeKeyToMember(
            channelId,
            m.username,
            m.public_key_pem,
            key,
            sendWs
          );
        } catch (err) {
          console.error('[key distribute]', m.username, err.message);
        }
      }
    },
    [user, ah, distributeKeyToMember]
  );

  const receiveWrappedKey = useCallback(
    async (encryptedAESKey) => {
      setKeyError(null);
      try {
        const key = await unwrapAESKey(encryptedAESKey, user.username);
        setAesKey(key);
        aesKeyRef.current = key;
      } catch {
        setKeyError(
          'Failed to decrypt squad key. Use Register on this browser to create new RSA keys.'
        );
      }
    },
    [user]
  );

  const setSquadAesKey = useCallback((key) => {
    setAesKey(key);
    aesKeyRef.current = key;
    setKeyError(null);
  }, []);

  return (
    <SquadContext.Provider
      value={{
        squads,
        activeSquad,
        aesKey,
        keyError,
        modPublicKey,
        refreshSquads,
        loadModKey,
        createSquad,
        joinSquad,
        selectSquad,
        distributeKeyToMember,
        distributeToAllMembers,
        receiveWrappedKey,
        setSquadAesKey,
        tryLoadWrappedKey,
      }}
    >
      {children}
    </SquadContext.Provider>
  );
}

export function useSquad() {
  const ctx = useContext(SquadContext);
  if (!ctx) throw new Error('useSquad must be used within SquadProvider');
  return ctx;
}
