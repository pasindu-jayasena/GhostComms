/**
 * Security role: WebSocket transport for encrypted squad traffic.
 */
import { WebSocketServer } from 'ws';
import { handleMessage, handleDisconnect } from './messageRouter.js';

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    ws.on('message', (data) => handleMessage(ws, data.toString()));
    ws.on('close', () => handleDisconnect(ws));
  });

  return wss;
}
