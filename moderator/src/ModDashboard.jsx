/**
 * Security role: Moderator UI — decrypt reports locally with pasted private key.
 */
import { useState } from 'react';
import {
  decryptReportPayload,
  normalizeModPrivateKeyPem,
  verifyModPrivateKey,
} from './crypto/modDecrypt.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const MOD_TOKEN = import.meta.env.VITE_MOD_API_TOKEN || '';

const STALE_REPORT_MSG =
  '[Encrypted with an older moderator key — only reports filed after sync-mod-env can be read]';

export default function ModDashboard() {
  const [privateKey, setPrivateKey] = useState('');
  const [reports, setReports] = useState([]);
  const [decrypted, setDecrypted] = useState({});
  const [error, setError] = useState('');
  const [keyOk, setKeyOk] = useState(null);

  const loadPrivateKeyFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPrivateKey(await file.text());
    e.target.value = '';
  };

  const loadReports = async () => {
    setError('');
    setKeyOk(null);
    setDecrypted({});

    if (!privateKey.trim()) {
      setError('Paste or load server/mod-private.pem first.');
      return;
    }

    const pem = normalizeModPrivateKeyPem(privateKey.trim());

    try {
      const pubRes = await fetch(`${API}/api/config/mod-pubkey`);
      const pubData = await pubRes.json();
      if (!pubRes.ok) throw new Error(pubData.error || 'Could not load moderator public key');

      const matches = await verifyModPrivateKey(pem, pubData.publicKey);
      setKeyOk(matches);
      if (!matches) {
        setError(
          'Private key does not match server MOD_PUBLIC_KEY. In server/: run npm run sync-mod-env, restart npm run dev, then load server/mod-private.pem here.'
        );
        return;
      }

      const res = await fetch(`${API}/api/mod/reports`, {
        headers: { Authorization: `Bearer ${MOD_TOKEN}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load reports');
      setReports(data.reports || []);

      const map = {};
      for (const r of data.reports || []) {
        try {
          map[r.report_id] = await decryptReportPayload(r.mod_encrypted_payload, pem);
        } catch (err) {
          map[r.report_id] =
            err?.name === 'OperationError' ? STALE_REPORT_MSG : `[Decryption failed: ${err?.message || err?.name}]`;
        }
      }
      setDecrypted(map);
    } catch (e) {
      setError(e.message);
    }
  };

  const updateStatus = async (reportId, status) => {
    await fetch(`${API}/api/mod/reports/${reportId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${MOD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });
    loadReports();
  };

  return (
    <div className="mod-dashboard">
      <h1>GhostComms Moderator</h1>
      <p className="hint">
        Load <strong>server/mod-private.pem</strong> (must match <strong>MOD_PUBLIC_KEY</strong> in server .env).
        After key changes: <code>npm run sync-mod-env</code> in <code>server/</code>, restart the server, refresh
        the game client, and file a <strong>new</strong> report. Older reports stay unreadable.
      </p>
      <label>
        Moderator private key (PEM)
        <textarea
          rows={8}
          value={privateKey}
          onChange={(e) => {
            setPrivateKey(e.target.value);
            setKeyOk(null);
          }}
          placeholder="-----BEGIN PRIVATE KEY-----"
        />
      </label>
      <div className="key-actions">
        <label className="file-btn">
          Load mod-private.pem
          <input type="file" accept=".pem,.txt,.key" onChange={loadPrivateKeyFile} hidden />
        </label>
        <button type="button" onClick={loadReports}>
          Load &amp; Decrypt Reports
        </button>
      </div>
      {keyOk === true && <p className="key-ok">Private key matches server.</p>}
      {error && <p className="error">{error}</p>}
      <div className="report-list">
        {reports.map((r) => (
          <article key={r.report_id} className="report-card">
            <p>
              <strong>Reported player:</strong> {r.reported_player}
            </p>
            <p>
              <strong>Reported by:</strong> {r.reported_by}
            </p>
            <p>
              <strong>Time:</strong> {r.timestamp}
            </p>
            <p>
              <strong>Status:</strong> {r.status}
            </p>
            <p className="decrypted">
              <strong>Message:</strong>{' '}
              {decrypted[r.report_id] || '(Load reports to decrypt)'}
            </p>
            <div className="actions">
              <button type="button" onClick={() => updateStatus(r.report_id, 'dismissed')}>
                Dismiss
              </button>
              <button type="button" className="ban" onClick={() => updateStatus(r.report_id, 'banned')}>
                Ban Player
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
