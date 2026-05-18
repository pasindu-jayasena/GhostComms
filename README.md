# GhostComms

Secure end-to-end encrypted gaming chat system (React + Node.js + WebSocket).

## Structure

- `client/` — Player app (E2E chat, signatures, reports)
- `server/` — API + WebSocket relay (never sees plaintext)
- `moderator/` — Moderator dashboard (client-side decrypt only)

## Requirements

- **Node.js 22.5+** (uses built-in `node:sqlite`; no native SQLite build step)

## Setup

### 1. Generate moderator keys (once)

```bash
cd server
npm install
npm run generate-mod-keys
```

Copy the **public** key into `server/.env` as `MOD_PUBLIC_KEY` (use `\n` for newlines or a single line). Keep the **private** key offline for the moderator dashboard.

### 2. Server environment

Copy `server/.env.example` to `server/.env` and set:

- `JWT_SECRET` — long random string
- `MOD_API_TOKEN` — token for moderator API (same value in `moderator/.env`)
- `MOD_PUBLIC_KEY` — from generate script
- `PORT=3001`
- `CLIENT_ORIGIN=http://localhost:5173`

### 3. Client & moderator env

```bash
cp client/.env.example client/.env
cp moderator/.env.example moderator/.env
```

Set `VITE_MOD_API_TOKEN` in `moderator/.env` to match `MOD_API_TOKEN`.

### 4. Install & run

```bash
cd server && npm install && npm run dev
cd client && npm install && npm run dev
cd moderator && npm install && npm run dev
```

- Client: http://localhost:5173
- Moderator: http://localhost:5174 (Vite default if 5173 taken)

## Manual test checklist

1. **E2E chat** — Two browsers, register two users, create squad, join with invite code, send messages.
2. **Signatures** — Tamper `signature` in a message object → ⚠️ Unverified badge.
3. **Replay** — Resend the same `nonce` via WebSocket → server `REPLAY_DETECTED` error.
4. **Report** — Report a message, paste mod private key in dashboard, decrypt.
5. **Server logs** — Only `messageId` and `channelId`, never plaintext.

## Security notes

- Player RSA private keys: IndexedDB only.
- Squad AES keys: memory only; distributed RSA-wrapped.
- Reports: hybrid RSA+AES to moderator public key.
