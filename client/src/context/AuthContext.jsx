/**
 * Security role: Player session (JWT) and local key lifecycle on register.
 */
import { createContext, useContext, useState, useCallback } from 'react';
import { apiFetch, authHeaders } from '../api.js';
import {
  generateRSAKeyPair,
  storePlayerKeys,
  getRegistrationPublicKeyPEM,
  hasKeys,
} from '../crypto/keyManager.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const u = sessionStorage.getItem('gc_username');
    const t = sessionStorage.getItem('gc_token');
    return u && t ? { username: u, token: t } : null;
  });
  const [loading, setLoading] = useState(false);
  const [keygenMessage, setKeygenMessage] = useState('');

  const persist = (username, token) => {
    sessionStorage.setItem('gc_username', username);
    sessionStorage.setItem('gc_token', token);
    setUser({ username, token });
  };

  const register = useCallback(async (username, password) => {
    setLoading(true);
    setKeygenMessage('🔑 Generating your secure keys...');
    try {
      const exists = await hasKeys(username);
      if (!exists) {
        const pair = await generateRSAKeyPair();
        await storePlayerKeys(username, pair);
      }
      const publicKey = await getRegistrationPublicKeyPEM(username);
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, publicKey }),
      });
      persist(data.username, data.token);
      return data;
    } finally {
      setLoading(false);
      setKeygenMessage('');
    }
  }, []);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    try {
      if (!(await hasKeys(username))) {
        throw new Error(
          'No RSA keys in this browser. Click "New operative? Register" (not Login) to generate keys.'
        );
      }
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      persist(data.username, data.token);
      return data;
    } finally {
      setLoading(false);
      setKeygenMessage('');
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('gc_username');
    sessionStorage.removeItem('gc_token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, keygenMessage, register, login, logout, authHeaders }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
