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
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

Create `frontend/.env` if you enable Google login:

```powershell
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Optional settings:

```powershell
OPENAI_MODEL=gpt-5.4
QUESTION_TIME_LIMIT_MS=20000
SESSION_RETENTION_MS=1800000
ENDED_SESSION_RETENTION_MS=600000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PLUS_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_CREDIT_PACK_20_PRICE_ID=price_...
STRIPE_CREDIT_PACK_60_PRICE_ID=price_...
STRIPE_CREDIT_PACK_150_PRICE_ID=price_...
FREE_AI_GAMES_PER_MONTH=3
DAILY_OPENAI_BUDGET_USD=10
MONTHLY_OPENAI_BUDGET_USD=100
MAX_ACTIVE_SESSIONS=500
MAX_PLAYERS_PER_SESSION=250
MAX_CONNECTED_PLAYERS=5000
DEGRADED_ACTIVE_SESSIONS=400
DEGRADED_CONNECTED_PLAYERS=4000
DEGRADED_HEAP_USED_MB=384
SOCKET_PING_INTERVAL_MS=25000
SOCKET_PING_TIMEOUT_MS=30000
CORS_ALLOWED_ORIGINS=https://your-service.up.railway.app,https://your-domain.com
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

1. A host creates a session and gets an 8-character room code.
2. Players join through `/session/<code>` or by entering the code manually.
3. The host chooses whether results reveal when the timer ends or as soon as all connected players answer.
4. The server owns the round timer and scoring, then broadcasts results to every player.
5. If a player refreshes, Kazoot reuses the stored player token to reconnect them to the same seat.

## AI generation and billing

- Anonymous hosts can create demo/fallback games, but GPT-5.4 generation requires Google sign-in through Supabase Auth.
- Signed-in users get 3 free AI-generated games per month by default.
- Paid usage is shown as AI games left: `1 AI game = 1 generated 10-question quiz`.
- Suggested starting tiers are Plus (`€5/month`, 20 AI games), Pro (`€12/month`, 75 AI games), and packs 20/60/150.
- Subscription AI games roll over for one extra billing period. Packs expire after 12 months.
- Stripe Checkout handles payments; Stripe webhooks grant AI games and keep an append-only ledger.
- Run `backend/db/001_ai_cost_controls.sql` in Supabase before enabling auth or billing.
- Existing positive paid balances in `usage_ledger` are backfilled into a non-expiring manual AI-game grant when the SQL is applied.
- Prompt inputs are treated as data and screened for instruction-like text before OpenAI is called.

## Realtime behavior

- Sessions live in memory for the lifetime of the server process.
- Reconnects work while the Railway instance stays alive.
- Sessions do not survive instance restarts because there is no shared database or Redis layer yet.
- Production is intentionally `single-instance-memory` mode. Keep the Railway service at exactly one replica.
- CORS is restricted to `FRONTEND_URL` plus explicit `CORS_ALLOWED_ORIGINS` entries in production.
- `/health` now reports store mode, session state counts, socket index size, uptime, memory, event-loop delay, and configured limits.
- `/diagnostics/sessions` is available outside production for session integrity and snapshot debugging.
- The single-replica caps protect the Node process from runaway room or player counts; tune them after load testing your Railway plan.

## API and socket contract

### HTTP

- `POST /api/create-session`
- `POST /api/generate-quiz`
- `GET /api/demo-topics`
- `GET /api/me/usage`
- `GET /api/billing/catalog`
- `POST /api/billing/create-checkout-session`
- `POST /api/billing/webhook`
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

Kazoot is intentionally optimized for a robust single-instance Railway deployment. If you later want multi-instance scale, restart-safe sessions, or thousands of concurrent players across replicas, the next step is moving session state, socket fan-out, and question timers to shared infrastructure such as Redis plus persistent storage.