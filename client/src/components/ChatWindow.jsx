import { useState, useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble.jsx';
import ReportModal from './ReportModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { encryptForModerator } from '../crypto/modReporting.js';
import { apiFetch, authHeaders, fetchModPublicKey } from '../api.js';

export default function ChatWindow({
  squad,
  members,
  messages,
  typingUser,
  aesKey,
  keyError,
  onSend,
  onTyping,
  user,
  isBanned,
}) {
  const { authHeaders: ah } = useAuth();
  const [text, setText] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const bottomRef = useRef(null);
  const channelId = squad?.channelId || squad?.channel_id;
  const squadName = squad?.name || 'Squad';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (isBanned) return;
    if (!text.trim()) return;
    try {
      await onSend(text.trim());
      setText('');
    } catch (err) {
      alert(err.message);
    }
  };

  const confirmReport = async () => {
    try {
      const { publicKey } = await fetchModPublicKey();
      const modEncryptedPayload = await encryptForModerator(reportTarget.text, publicKey);
      await apiFetch('/api/report', {
        method: 'POST',
        headers: ah(user.token),
        body: JSON.stringify({
          reportedPlayer: reportTarget.senderId,
          modEncryptedPayload,
        }),
      });
      setReportTarget(null);
      alert('Report submitted to moderators.');
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <main className="chat-window">
      <header className="chat-header">
        <div>
          <h2>{squadName}</h2>
          <span className="e2e-badge">E2E Encrypted</span>
        </div>
        <div className="member-avatars">
          {members?.map((m) => (
            <span key={m.username} className="avatar" title={m.username}>
              {m.username[0].toUpperCase()}
            </span>
          ))}
        </div>
      </header>
      {keyError && <p className="error-msg">{keyError}</p>}
      {!aesKey && !keyError && (
        <p className="key-wait">
          Waiting for squad encryption key… Ask the squad creator to open this squad (both players
          must be online). New here? Use <strong>Register</strong> (not Login) once to generate RSA
          keys in this browser.
        </p>
      )}
      <div className="messages">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isOwn={m.senderId === user?.username}
            onReport={setReportTarget}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      {typingUser && typingUser !== user?.username && (
        <p className="typing">{typingUser} is typing...</p>
      )}
      <form className="chat-input" onSubmit={handleSend}>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping?.();
          }}
          placeholder={
            isBanned ? 'Banned — cannot send messages' : aesKey ? 'Encrypted message...' : 'Waiting for keys...'
          }
          disabled={!aesKey || isBanned}
        />
        <button type="submit" disabled={!aesKey || isBanned}>
          Send
        </button>
      </form>
      <ReportModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        onConfirm={confirmReport}
      />
    </main>
  );
}
