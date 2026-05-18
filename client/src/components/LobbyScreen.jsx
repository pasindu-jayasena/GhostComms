import { useState } from 'react';
import { useSquad } from '../context/SquadContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function LobbyScreen({ onSelectSquad }) {
  const { user } = useAuth();
  const { squads, createSquad, joinSquad, activeSquad } = useSquad();
  const [name, setName] = useState('');
  const [invite, setInvite] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCreate = async () => {
    setError('');
    setSuccess('');
    try {
      const squad = await createSquad(name || 'Alpha Squad');
      await onSelectSquad(squad, squad.squadAesKey);
      setName('');
      setSuccess(`Squad created — share invite code: ${squad.inviteCode}`);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleJoin = async () => {
    setError('');
    setSuccess('');
    const code = invite.trim();
    if (!code) {
      setError('Enter an invite code from the squad creator.');
      return;
    }
    try {
      const squad = await joinSquad(code);
      onSelectSquad(squad);
      setInvite('');
    } catch (e) {
      setError(e.message || 'Could not join squad — check the invite code.');
    }
  };

  return (
    <aside className="lobby">
      <h2 className="lobby-title">Squads</h2>
      {error && <p className="error-msg">{error}</p>}
      {success && <p className="success-msg">{success}</p>}
      <div className="squad-list">
        {squads.map((s) => (
          <button
            key={s.channel_id}
            type="button"
            className={`squad-item ${activeSquad?.channel_id === s.channel_id || activeSquad?.channelId === s.channel_id ? 'active' : ''}`}
            onClick={() => onSelectSquad(s)}
          >
            <span className="squad-name">{s.name}</span>
            <span className="squad-meta">
              🔒 {s.member_count} members
            </span>
          </button>
        ))}
      </div>
      <div className="lobby-actions">
        <input
          placeholder="New squad name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="button" className="btn-primary" onClick={handleCreate}>
          CREATE SQUAD
        </button>
        <input
          placeholder="Invite code"
          value={invite}
          onChange={(e) => setInvite(e.target.value)}
        />
        <button type="button" className="btn-secondary" onClick={handleJoin}>
          JOIN SQUAD
        </button>
      </div>
      <div className="identity-card">
        <strong>{user?.username}</strong>
        <span className="identity-badge">🛡️ Identity Verified</span>
      </div>
    </aside>
  );
}
