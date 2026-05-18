import { useEffect, useState, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SquadProvider, useSquad } from './context/SquadContext.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import LobbyScreen from './components/LobbyScreen.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useEncryptedChat } from './hooks/useEncryptedChat.js';
import { apiFetch, authHeaders } from './api.js';
import './App.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function MainApp() {
  const { user, logout } = useAuth();
  const [serverOnline, setServerOnline] = useState(null);
  const {
    activeSquad,
    aesKey,
    keyError,
    refreshSquads,
    loadModKey,
    selectSquad,
    distributeToAllMembers,
    receiveWrappedKey,
    tryLoadWrappedKey,
  } = useSquad();
  const [members, setMembers] = useState([]);
  const [isBanned, setIsBanned] = useState(false);
  const channelId = activeSquad?.channelId || activeSquad?.channel_id;
  const sendWsRef = useRef(null);
  const handleIncomingRef = useRef(null);

  const onWsMessage = useCallback(
    async (msg) => {
      if (msg.type === 'BANNED' || (msg.type === 'ERROR' && msg.code === 'BANNED')) {
        setIsBanned(true);
        return;
      }
      if (msg.type === 'CHANNEL_JOINED') {
        setMembers(msg.members || []);
        sendWsRef.current?.({ type: 'REQUEST_SQUAD_KEY' });
        return;
      }
      if (msg.type === 'SQUAD_KEY_NEEDED' && msg.username) {
        await distributeToAllMembers(
          handleIncomingRef.current?.channelId,
          sendWsRef.current,
          msg.username
        );
        return;
      }
      if (msg.type === 'MEMBER_JOINED') {
        setMembers((prev) => {
          if (prev.some((m) => m.username === msg.username)) return prev;
          return [...prev, { username: msg.username, public_key_pem: msg.pubkey }];
        });
        await distributeToAllMembers(
          handleIncomingRef.current?.channelId,
          sendWsRef.current,
          msg.username
        );
        return;
      }
      if (msg.type === 'KEY_EXCHANGE') {
        await receiveWrappedKey(msg.encryptedAESKey);
        return;
      }
      handleIncomingRef.current?.fn?.(msg);
    },
    [distributeToAllMembers, receiveWrappedKey]
  );

  const { send: sendWs, connected } = useWebSocket(onWsMessage, !!user && serverOnline === true);
  sendWsRef.current = sendWs;

  const {
    messages,
    typingUser,
    sendMessage,
    sendTyping,
    handleIncoming,
    clearMessages,
  } = useEncryptedChat({
    user,
    aesKey,
    channelId,
    sendWs,
    isBanned,
  });

  handleIncomingRef.current = { fn: handleIncoming, aesKey, user, channelId };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${API}/api/health`);
        if (!cancelled) setServerOnline(res.ok);
      } catch {
        if (!cancelled) setServerOnline(false);
      }
    };
    check();
    const id = setInterval(check, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setIsBanned(false);
      return;
    }
    let cancelled = false;
    const checkBan = async () => {
      try {
        const data = await apiFetch('/api/auth/me', { headers: authHeaders(user.token) });
        if (!cancelled) setIsBanned(!!data.banned);
      } catch {
        if (!cancelled) setIsBanned(false);
      }
    };
    checkBan();
    const id = setInterval(checkBan, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

  useEffect(() => {
    if (!user || serverOnline !== true) return;
    refreshSquads();
    loadModKey();
  }, [user, serverOnline, refreshSquads, loadModKey]);

  useEffect(() => {
    if (!user || !channelId || !connected) return;
    sendWs({ type: 'JOIN_CHANNEL', channelId, token: user.token });
    clearMessages();
    (async () => {
      const data = await apiFetch(`/api/squad/${channelId}/members`, {
        headers: authHeaders(user.token),
      });
      setMembers(data.members || []);
      await distributeToAllMembers(channelId, sendWs);
    })();
  }, [user?.username, channelId, connected]);

  useEffect(() => {
    if (!user || !channelId || aesKey || !connected) return;
    tryLoadWrappedKey(channelId);
    const id = setInterval(() => tryLoadWrappedKey(channelId), 5000);
    return () => clearInterval(id);
  }, [user, channelId, aesKey, connected, tryLoadWrappedKey]);

  const onSelectSquad = async (squad, squadAesKeyOverride) => {
    clearMessages();
    if (squadAesKeyOverride) {
      await selectSquad(squad, { squadAesKey: squadAesKeyOverride });
    } else {
      await selectSquad(squad);
    }
    const id = squad.channelId || squad.channel_id;
    const data = await apiFetch(`/api/squad/${id}/members`, {
      headers: authHeaders(user.token),
    });
    setMembers(data.members || []);
    if (squadAesKeyOverride) {
      await distributeToAllMembers(id, sendWs);
    }
  };

  useEffect(() => {
    if (!user || !channelId || !aesKey || !connected) return;
    distributeToAllMembers(channelId, sendWs);
  }, [aesKey, channelId, connected, distributeToAllMembers, sendWs, user]);

  if (!user) return <LoginScreen />;

  return (
    <div className="app-shell">
      <header className="top-bar">
        <span className="brand">GhostComms</span>
        <button type="button" className="btn-link" onClick={logout}>
          Disconnect
        </button>
      </header>
      {isBanned && (
        <div className="banned-banner">
          Your account has been banned from chat. You cannot send messages.
        </div>
      )}
      {serverOnline === false && (
        <div className="server-offline-banner">
          Backend offline — open a terminal in <strong>server/</strong> and run{' '}
          <code>npm run dev</code>, then refresh this page.
        </div>
      )}
      <div className="main-layout">
        <LobbyScreen onSelectSquad={onSelectSquad} />
        {activeSquad ? (
          <ChatWindow
            squad={activeSquad}
            members={members}
            messages={messages}
            typingUser={typingUser}
            aesKey={aesKey}
            keyError={keyError}
            onSend={sendMessage}
            onTyping={sendTyping}
            user={user}
            isBanned={isBanned}
          />
        ) : (
          <main className="chat-placeholder">Select or create a squad to deploy.</main>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SquadProvider>
        <MainApp />
      </SquadProvider>
    </AuthProvider>
  );
}
