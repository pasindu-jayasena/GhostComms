/**
 * Security role: Real-time transport for encrypted message envelopes.
 */
import { useEffect, useRef, useCallback, useState } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export function useWebSocket(onMessage, enabled = true) {
  const wsRef = useRef(null);
  const reconnectAttempt = useRef(0);
  const intentionalClose = useRef(false);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const send = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      intentionalClose.current = true;
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      return;
    }

    intentionalClose.current = false;
    let reconnectTimer;

    const connect = () => {
      if (intentionalClose.current) return;
      const state = wsRef.current?.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempt.current = 0;
        setConnected(true);
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (intentionalClose.current) return;
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 15000);
        reconnectAttempt.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        /* onclose handles reconnect */
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          onMessageRef.current?.(data);
        } catch {
          /* ignore */
        }
      };
    };

    connect();

    return () => {
      intentionalClose.current = true;
      clearTimeout(reconnectTimer);
      const ws = wsRef.current;
      wsRef.current = null;
      if (!ws) {
        setConnected(false);
        return;
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        // Avoid "closed before connection established" (React Strict Mode)
        ws.addEventListener('open', () => ws.close(), { once: true });
      }
      setConnected(false);
    };
  }, [enabled]);

  return { send, connected, wsRef };
}
