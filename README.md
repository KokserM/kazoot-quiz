# Kazoot

Live multiplayer quizzes where the host plays too. A host picks a topic, AI writes a
10-question quiz, players join on their phones with a room code, and the host competes
without having seen the questions. A free demo with hand-written quizzes needs no account.

Launch status, test evidence, pricing analysis and the owner checklist: **[LAUNCH.md](LAUNCH.md)**.
Deploying, migrations and rollback: **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## Architecture

One Node process on Railway serves everything:

```
Browser ──HTTPS──> Express (backend/src/http)      REST API, Stripe webhook, static frontend
        ──WSS────> Socket.IO (backend/src/socket)  live game protocol
                      │
                      ├─ GameService + SessionStore  room state, timers, scoring  (in memory)
                      ├─ QuestionService             OpenAI generation + curated demo quizzes
                      ├─ AiUsageService ──service role──> Supabase Postgres  credits, ledger, payments
                      └─ StripeBillingService ─────────> Stripe             checkout, portal, webhooks
Browser ──────────> Supabase Auth (Google sign-in; the browser only holds the anon key)
```

Trust boundaries:

- **The server owns the game.** Correct answers never leave the server before the reveal;
  deadlines, scoring, and who may start or advance are decided server-side.
- **Credits change only inside Postgres functions** (`backend/db/003_launch_hardening.sql`)
  called with the service role. Users can read their own billing rows through RLS and
  cannot write any of them.
- **Entitlements come only from verified Stripe webhooks** (or replaying Stripe's own event
  log), never from the checkout redirect.
- Room state is in memory: **run exactly one replica**. A restart ends live games; clients
  are told and shown a clear message.

## Local development

Requirements: Node.js 22+.

```bash
npm --prefix backend install
```

```bash
npm --prefix frontend install
```

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`.
Everything is optional locally: without Supabase, auth is off (demo works); without an
OpenAI key, AI generation is unavailable (demo works); without Stripe, checkout is off.

```bash
npm --prefix backend run dev
```

```bash
npm --prefix frontend run dev
```

Frontend: http://localhost:3000 · API and sockets: http://localhost:5000.

## Tests

```bash
npm --prefix backend test
```

Backend: real Socket.IO game tests, billing tests with signed Stripe webhooks, and
Postgres/RLS tests on PGlite (real Postgres in WebAssembly — no Docker needed).

```bash
npm --prefix frontend test
```

Frontend: component and logic tests, WCAG contrast of design tokens, axe accessibility checks.

Load test (never against production):

```bash
npm --prefix backend run loadtest -- --url http://127.0.0.1:5000 --rooms 10 --players 30
```

## Useful scripts

- `npm --prefix backend run reconcile:stripe -- --days 30` — dry-run replay of Stripe events; add `--apply` to fix missed grants.
- `backend/db/queries/operations.sql` — funnel, costs, and billing audit queries.

## Project layout

```
backend/
  db/                 SQL migrations (run in order) and operational queries
  scripts/            reconcile-stripe.js, loadtest.js
  src/game/           rooms, timers, scoring, reconnection
  src/quiz/           AI generation, curated demo quizzes
  src/billing/        credits, Stripe, plan catalog
  src/http, socket/   transport
  test/               integration tests
frontend/src/
  pages/              landing, demo, create, join, game, account, legal
  components/game/    lobby, question, results, final screens
  components/ui.jsx   design-system primitives; styles/tokens.js colours
  providers/          game client (socket protocol), auth
```

## Design system

- **Palette from the logo** (`frontend/src/styles/tokens.js`): the K's violet → magenta stroke on
  an aubergine tile. A cool-white light theme for the site (landing, setup, pricing, account) and
  an aubergine **stage** theme for every live game screen (`<html data-stage="true">`), the
  landing preview and closing panel (`data-stage-scope`). Dark-mode users get the stage palette.
- **Action colour:** violet `#7C3AED` → magenta `#C026D3` (`--brand-gradient`), white text
  (5.7:1 / 4.7:1). It is the only gradient in the UI and marks the primary action; repeated
  actions (one per pricing card) use the quieter `tonal` button. Violet *text* is `--accent-text`.
- **Answer tiles:** cyan, pink, amber, periwinkle with dark text, always with a letter, never
  shapes, never red/green (those mean wrong/right) and never the brand violet. Chosen, correct and
  incorrect are distinguished by ring, fill, icon and label — a selection is never styled like a
  correct answer. Tile focus is dashed so it can't be confused with the solid rings.
- **Motion** (`frontend/src/lib/motion.js`): pointer tilt writes CSS variables in
  `requestAnimationFrame` (no re-renders), only for fine pointers without reduced motion. Used by
  pricing cards (≤3°) and the hero logo (`components/BrandMark.jsx`: CSS entrance, one masked light
  sweep, then settled; the raster logo is animated whole, never redrawn).
- **Header:** sticky and translucent (blur, opaque fallback) on site pages; static and minimal in games.
- **Shape:** 12 px controls, 16–18 px cards and tiles, 8 px labels. Pills are avoided.
- **Type:** Bricolage Grotesque (display) and Atkinson Hyperlegible (body), self-hosted.
- Contrast for every text and control pair is enforced by `App.test.jsx`; axe checks run in
  `a11y.test.jsx`.
