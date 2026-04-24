# Kazoot

Kazoot is a modern Kahoot-style quiz app with GPT-5.4 question generation, Railway-friendly realtime multiplayer, and a rebuilt Vite frontend.

## What changed

- GPT-5.4 questions now use structured JSON output plus duplicate filtering within the running service.
- Multiplayer uses a server-authoritative round engine with reconnect tokens, guarded state transitions, and idempotent scoring.
- The frontend is now a routed Vite app with a cleaner session shell, better responsive layout, and reconnect-aware join flows.
- Railway, Docker, and local development all target the same single-instance deployment model.

## Stack

- Frontend: React 19, Vite, React Router, styled-components, framer-motion, socket.io-client
- Backend: Node.js, Express, Socket.IO, OpenAI, zod
- Hosting target: one Railway service serving the API, sockets, and built frontend assets

## Local setup

### Requirements

- Node.js 20 or newer
- npm
- An OpenAI API key if you want live GPT-5.4 quiz generation

### Install

```powershell
npm install
Set-Location backend
npm install
Set-Location ..\frontend
npm install
Set-Location ..
```

### Configure the backend

Create `backend/.env` and add the values you need:

```powershell
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

Optional settings:

```powershell
OPENAI_MODEL=gpt-5.4
QUESTION_TIME_LIMIT_MS=20000
SESSION_RETENTION_MS=1800000
ENDED_SESSION_RETENTION_MS=600000
```

### Run the app

```powershell
npm run dev
```

Or in separate shells:

```powershell
npm run server
```

```powershell
npm run client
```

The frontend runs on `http://localhost:3000` and the backend runs on `http://localhost:5000`.

## Game flow

1. A host creates a session and gets a 6-character room code.
2. Players join through `/session/<code>` or by entering the code manually.
3. The server owns the round timer and scoring, then broadcasts results to every player.
4. If a player refreshes, Kazoot reuses the stored player token to reconnect them to the same seat.

## Realtime behavior

- Sessions live in memory for the lifetime of the server process.
- Reconnects work while the Railway instance stays alive.
- Sessions do not survive instance restarts because there is no shared database or Redis layer yet.
- Production is intentionally `single-instance-memory` mode. Keep the Railway service at exactly one replica.
- CORS is restricted to configured origins plus Railway domains in production.
- `/health` now reports store mode, session state counts, socket index size, and uptime.
- `/diagnostics/sessions` is available outside production for session integrity and snapshot debugging.

## API and socket contract

### HTTP

- `POST /api/create-session`
- `POST /api/generate-quiz`
- `GET /api/demo-topics`
- `GET /health`

### Socket events

- Client to server: `join-game`, `start-game`, `submit-answer`, `next-question`
- Server to client: `joined-game`, `session-updated`, `question-start`, `answer-submitted`, `question-results`, `game-end`, `admin-changed`

`question-start` now includes `roundId`, `questionStartedAt`, `questionEndsAt`, and `serverTime` so the UI can stay synchronized with the backend timer.

## Commands

```powershell
npm run build
```

Build the frontend bundle.

```powershell
npm test
```

Run backend and frontend automated tests.

## Known boundary

Kazoot is intentionally optimized for a robust single-instance Railway deployment. If you later want multi-instance scale or restart-safe sessions, the next step is moving session state and socket fan-out to shared infrastructure such as Redis plus persistent storage.