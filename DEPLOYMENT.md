# Deploying Kazoot to Railway

Kazoot is designed to run as a single Railway service that serves the built frontend, the REST API, and the Socket.IO server from the same Node process.

## Railway model

- One Railway service
- One Node process
- In-memory sessions
- Reconnect support while the process stays alive
- No cross-instance session sharing yet

This is the intended production boundary for the current version.

Important: keep the Railway service scaled to exactly one replica. The app now logs its `single-instance-memory` runtime mode at startup, but it still relies on a single Node process for room state.

## Required environment variables

Set these in Railway:

```text
NODE_ENV=production
FRONTEND_URL=https://your-service-or-custom-domain
CORS_ALLOWED_ORIGINS=https://your-service-or-custom-domain,https://your-custom-domain
OPENAI_API_KEY=sk-...         # optional
OPENAI_MODEL=gpt-5.6-sol      # optional
OPENAI_EST_INPUT_COST_PER_1M=4   # current GPT-5.6 Sol estimate
OPENAI_EST_OUTPUT_COST_PER_1M=20 # current GPT-5.6 Sol estimate
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PLUS_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_CREDIT_PACK_20_PRICE_ID=price_...
STRIPE_CREDIT_PACK_60_PRICE_ID=price_...
STRIPE_CREDIT_PACK_150_PRICE_ID=price_...
VITE_SUPPORT_EMAIL=support@kazoot.app
FREE_AI_GAMES_PER_MONTH=3
DAILY_OPENAI_BUDGET_USD=10
MONTHLY_OPENAI_BUDGET_USD=100
QUESTION_TIME_LIMIT_MS=20000  # optional
SESSION_RETENTION_MS=1800000  # optional
ENDED_SESSION_RETENTION_MS=600000  # optional
MAX_ACTIVE_SESSIONS=500            # optional
MAX_PLAYERS_PER_SESSION=250        # optional
MAX_CONNECTED_PLAYERS=5000         # optional
DEGRADED_ACTIVE_SESSIONS=400       # optional
DEGRADED_CONNECTED_PLAYERS=4000    # optional
DEGRADED_HEAP_USED_MB=384          # optional
SOCKET_PING_INTERVAL_MS=25000      # optional
SOCKET_PING_TIMEOUT_MS=30000       # optional
```

Notes:

- Do not hardcode `PORT` in Railway. The platform injects it automatically.
- If `OPENAI_API_KEY` is missing, Kazoot falls back to demo question sets.
- Keep the OpenAI cost-estimate variables aligned with current API pricing so budget tracking remains accurate.
- `FRONTEND_URL` should match the public domain you want to allow through CORS.
- Use `CORS_ALLOWED_ORIGINS` for any extra custom domains or Railway aliases; production no longer trusts every `*.railway.app` origin by default.
- Run `backend/db/001_ai_cost_controls.sql` in Supabase before setting live Stripe prices.
- The SQL backfills existing positive paid balances from `usage_ledger` into non-expiring manual AI-game grants for already registered users.
- Configure Google as a Supabase Auth provider and add your Railway domain to allowed redirect URLs.
- Set `VITE_SUPPORT_EMAIL` to the public support address shown in trust copy and policy pages. For the current launch, `support@kazoot.app` can forward through Porkbun email forwarding.

Supabase Auth URL configuration for production:

- Site URL: `https://kazoot.app`
- Redirect URLs: `https://kazoot.app/**`
- Add `https://www.kazoot.app/**` only if the `www` domain is live.
- Add Railway-generated domains only if users can reach the app through those URLs.

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
- Hosts can choose whether results reveal when the timer ends or when all connected players have answered.
- GPT-5.6 Sol generation requires a signed-in host and consumes free monthly quota or paid AI games.
- Anonymous hosts can still create demo/fallback games without spending GPT tokens.
- `GET /health` includes store mode, active sessions, sessions by state, socket index size, uptime, memory usage, event-loop delay, configured limits, and degraded reasons.

## Monetization runbook

1. Create Supabase project and run `backend/db/001_ai_cost_controls.sql`.
2. Enable Google login in Supabase Auth.
3. Create Stripe products/prices for Plus 30 (`€5/month`), Pro 90 (`€12/month`), and packs 20 (`€5`), 60 (`€12`), and 150 (`€25`).
4. Add the Stripe webhook endpoint: `https://your-domain/api/billing/webhook`.
5. Test with Stripe test mode before using live price IDs.
6. Keep display prices in `backend/src/billing/stripeBillingService.js` synchronized with Stripe prices.
7. If Plus subscribers already received a current grant below 30 credits before the Plus 30 change, review and optionally run `backend/db/002_plus_30_top_up.sql`.
8. Monitor `quiz_generations.estimated_cost_usd`, free usage, AI-game grant balances, and failed/refunded generations.
9. Start with conservative caps and adjust pricing after real token usage data.

## Scale runbook

For the current single-replica architecture:

1. Keep Railway scaled to exactly one replica.
2. Monitor `GET /health` for `status`, `activeSessions`, `connectedPlayers`, `socketIndexSize`, memory, and `degradedReasons`.
3. Raise or lower `MAX_ACTIVE_SESSIONS`, `MAX_PLAYERS_PER_SESSION`, and `MAX_CONNECTED_PLAYERS` after real load testing.
4. Deploy during quiet periods because active in-memory sessions are lost on restart.

Before scaling to multiple Railway replicas:

1. Move sessions, players, scores, and game state into Redis or a database.
2. Add the Socket.IO Redis adapter so room broadcasts work across replicas.
3. Use sticky sessions for Engine.IO polling/WebSocket traffic.
4. Replace process-local timers with a shared timer worker, Redis TTL/pub-sub, or persisted round-deadline strategy.
5. Run load tests with realistic room counts before advertising support for thousands of concurrent players.

## Verification checklist

After deploy, verify:

1. `GET /health` returns `200`
2. Creating a session succeeds
3. Joining from two browsers updates the lobby in real time
4. Refreshing a player tab reconnects the player instead of duplicating them
5. Finishing a round shows identical results to all players

## GPT model rollout and rollback

For the Railway service serving `https://kazoot.app`:

1. Choose a quiet deployment window because changing Railway variables restarts the process and ends active in-memory games.
2. Confirm the service is still scaled to exactly one replica.
3. Set `OPENAI_MODEL=gpt-5.6-sol`, `OPENAI_EST_INPUT_COST_PER_1M=4`, and `OPENAI_EST_OUTPUT_COST_PER_1M=20`.
4. Deploy and confirm the startup log reports `Question model: gpt-5.6-sol`.
5. Verify `https://kazoot.app/health` returns `200`.
6. Create a signed-in AI game and a successor game; confirm both produce 10 generated questions rather than demo fallback.
7. Confirm `quiz_generations` records model `gpt-5.6-sol`, token counts, successful status, and plausible estimated cost.
8. Verify anonymous demo creation, player joining, reconnect, and live round synchronization still work.

To roll back, restore `OPENAI_MODEL=gpt-5.4`, `OPENAI_EST_INPUT_COST_PER_1M=2.5`, and `OPENAI_EST_OUTPUT_COST_PER_1M=15`, then redeploy.

## Troubleshooting

### Session resets after restart

That is expected with the current single-instance in-memory architecture. Add Redis or a database later if you need restart-safe sessions.

### Sessions break after scaling replicas

That is expected if the service runs with more than one replica. Kazoot does not share room state across replicas yet, so keep Railway scaled to one replica until shared state is introduced.

### WebSockets do not connect

- Confirm the app is being served from the same Railway service as the API
- Verify `FRONTEND_URL` matches the public origin
- Check Railway logs for CORS errors

### GPT-5.6 Sol generation falls back to demo data

- Confirm `OPENAI_API_KEY` is present and valid
- Check the server logs for OpenAI errors
- Make sure your OpenAI project has access to `gpt-5.6-sol`