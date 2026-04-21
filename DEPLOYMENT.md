# Deploying Kazoot to Railway

Kazoot is designed to run as a single Railway service that serves the built frontend, the REST API, and the Socket.IO server from the same Node process.

## Railway model

- One Railway service
- One Node process
- In-memory sessions
- Reconnect support while the process stays alive
- No cross-instance session sharing yet

This is the intended production boundary for the current version.

## Required environment variables

Set these in Railway:

```text
NODE_ENV=production
FRONTEND_URL=https://your-service-or-custom-domain
OPENAI_API_KEY=sk-...         # optional
OPENAI_MODEL=gpt-5.4          # optional
QUESTION_TIME_LIMIT_MS=20000  # optional
SESSION_RETENTION_MS=1800000  # optional
ENDED_SESSION_RETENTION_MS=600000  # optional
```

Notes:

- Do not hardcode `PORT` in Railway. The platform injects it automatically.
- If `OPENAI_API_KEY` is missing, Kazoot falls back to demo question sets.
- `FRONTEND_URL` should match the public domain you want to allow through CORS.

## Build and start behavior

Railway uses `nixpacks.toml` in this repo to:

1. Run `npm ci` in the root, `frontend`, and `backend`
2. Build the Vite frontend with `cd frontend && npm run build`
3. Start the backend with `cd backend && node server.js`

The backend serves `frontend/dist` in production.

## What to expect in production

- Players can reconnect to the same session with their saved player token.
- Question timing is server-authoritative and synced to the client with `questionEndsAt` and `serverTime`.
- Host changes are broadcast automatically if the current host disconnects.
- Sessions are cleaned up after inactivity.

## Verification checklist

After deploy, verify:

1. `GET /health` returns `200`
2. Creating a session succeeds
3. Joining from two browsers updates the lobby in real time
4. Refreshing a player tab reconnects the player instead of duplicating them
5. Finishing a round shows identical results to all players

## Troubleshooting

### Session resets after restart

That is expected with the current single-instance in-memory architecture. Add Redis or a database later if you need restart-safe sessions.

### WebSockets do not connect

- Confirm the app is being served from the same Railway service as the API
- Verify `FRONTEND_URL` matches the public origin
- Check Railway logs for CORS errors

### GPT-5.4 generation falls back to demo data

- Confirm `OPENAI_API_KEY` is present and valid
- Check the server logs for OpenAI errors
- Make sure your account has access to `gpt-5.4`