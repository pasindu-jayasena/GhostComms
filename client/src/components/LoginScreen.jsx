import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginScreen() {
  const { register, login, loading, keygenMessage } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) await register(username, password);
      else await login(username, password);
    } catch (err) {
      setError(err.message || 'Connection failed');
    }
  };

  return (
    <div className="login-screen">
      <div className="particles" aria-hidden="true" />
      <form className="login-card" onSubmit={submit}>
        <h1 className="logo">GhostComms</h1>
        <p className="tagline">Secure E2E Gaming Comms</p>
        {keygenMessage && <p className="keygen-spinner">{keygenMessage}</p>}
        {error && <p className="error-msg">{error}</p>}
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
          />
        </label>
        <button type="submit" className="btn-connect" disabled={loading}>
          {loading ? 'CONNECTING...' : 'CONNECT'}
        </button>
        <button
          type="button"
          className="btn-link"
          onClick={() => setIsRegister(!isRegister)}
        >
          {isRegister ? 'Already have an account? Login' : 'New operative? Register'}
        </button>
      </form>
    </div>
  );
}
