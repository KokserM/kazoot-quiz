# Kazoot launch readiness — September 2026

Branch `launch-readiness`. Nothing has been deployed, no live Stripe settings changed, no
production data touched. This document is the handoff: what changed, what was tested,
what still blocks paid launch, and what the owner needs to decide.

## What the audit found

**Architecture ("no backend" is not accurate).** A Node/Express + Socket.IO server on
Railway runs the game (rooms, timers, scoring in process memory), calls OpenAI, creates
Stripe Checkout sessions, receives Stripe webhooks, and writes credits to Supabase with the
service-role key. The browser only talks to Supabase for Google sign-in. That server is the
correct trust boundary; no new infrastructure was needed.

Most serious problems found (all fixed on this branch):

| # | Problem | Impact |
| --- | --- | --- |
| 1 | Stripe SDK pins API `2026-04-22.dahlia`, where `invoice.subscription` and `subscription.current_period_end` no longer exist. The webhook read those fields. | **Plus/Pro renewals likely granted no AI games** (unless the webhook endpoint is pinned to an older API version). Needs a production audit — see blocker 1. |
| 2 | Webhook recorded the payment *before* granting; if the grant failed, Stripe's retry saw "already recorded" and skipped it. | Paid, never credited, silently. |
| 3 | When AI generation failed, or for any signed-out host, the server created a room with an unrelated demo quiz (e.g. 90s movies) labelled with the user's topic. | Misleading product; a paying host's "Roman history" quiz could be about films. |
| 4 | Room codes are 10 characters; the "Join by code" form cut input to 8 and only accepted 6 or 8. | **Nobody could join by typing the code** — only by link/QR. |
| 5 | RLS let signed-in users update their own `profiles` row, including `stripe_customer_id` (reproduced on the production schema). | Would become billing-portal takeover once a portal is added. |
| 6 | Credit consumption was read-modify-write in JS with an in-process lock; a crash mid-generation lost the credit forever. | Double-spend across processes; lost credits. |
| 7 | Checkout granted packs on `checkout.session.completed` regardless of `payment_status`; no refund/dispute handling; a new Stripe customer per checkout; no cancellation path. | Credits for unpaid SEPA; refunded buyers keep credits; users can't cancel themselves. |
| 8 | Socket rate limits keyed on the *first* `X-Forwarded-For` entry (client-controlled). | Rate limits bypassable. |
| 9 | Dependencies: high-severity advisories in `engine.io`, `ws`, `socket.io-parser`, `react-router`; Node 20 (EOL April 2026) in the Dockerfile. | |
| 10 | No OpenAI timeout (SDK default 10 min × retries), no structured output, per-question validation rejected whole quizzes. | Hanging requests; wasted paid retries. |

## 1. Summary of changes

**Security & data**
- `db/003_launch_hardening.sql` (additive, idempotent): removes the client-writable profile
  policy; adds atomic Postgres functions to reserve / complete / release AI games and to
  grant / revoke credits (service-role only — `EXECUTE` revoked from `anon`/`authenticated`);
  stale-reservation release; data-retention function; anonymous `product_events` table.
- Trusted client IP for rate limits; generic error messages to clients (no DB/provider
  text); JSON body limit 64 kB; Socket.IO payload limit 16 kB; strict CSP kept; immutable
  asset caching; no `x-powered-by`.
- Account self-deletion (refused while a subscription is active). Enforced retention:
  IP addresses 30 days, quiz topics 12 months, anonymous events 13 months.

**Credits (defined lifecycle).** *Reserve* when generation starts (a free monthly game is
counted, or a purchased game is removed from the soonest-expiring grant) → *complete* on
success (charged) → *release* on any failure, timeout, rejected topic, or process crash
(the free game or purchased game is given back exactly once; the sweeper releases
reservations older than 10 minutes). Retries inside one generation never charge twice.
Free games are spent first, then purchased games that expire soonest, non-expiring last.

**Stripe.** Current API shapes (and older ones); grant-then-record so failures are retried
(500 → Stripe retries); `payment_status` respected, async payments handled; refunds remove
unused games proportionally and disputes remove all remaining, each exactly once; every
subscription event re-reads the subscription from Stripe (event order doesn't matter); one
Stripe customer per user; second subscription blocked; billing portal; proration invoices
don't grant; consent to immediate supply required before checkout; reconciliation script
replays Stripe's event log idempotently; plans offered to new buyers configurable with
`BILLING_VISIBLE_PLANS` without affecting existing customers. **No prices changed.**

**AI generation.** No substitute questions ever: failure → clear message, game given back.
Strict JSON schema; the model returns the right answer + three wrong ones and the server
shuffles (removes index/answer mismatches and position bias); asks for 12, keeps the best
10 after checks (duplicates, duplicate choices, answer in question, "all of the above",
prompt leakage, repeats of recent quizzes); OpenAI moderation on the topic; model can
decline private/inappropriate/too-narrow topics with a reason ("AI can't know your inside
jokes"); 45 s timeout, one SDK retry, max two attempts, no retry on auth errors; falls back
to prompt-only JSON if the model rejects structured output. Difficulty selector.

**Multiplayer.** Every action is acknowledged; the UI shows "Locked in" only after the
server accepted the answer and says so when it didn't. Stale/duplicate "next" and "start"
clicks can't skip questions (`fromQuestionIndex`). 400 ms answer grace for network
latency. Late joins. Seats restored after reload/backgrounding (per room *and* name, so
two tabs can't steal each other's seat). Host drop: 20 s grace ("host is reconnecting"),
then the longest-connected player can stand in; the owner reclaims control on return.
Lightweight resync on tab focus instead of a full re-join. Broadcasts are room-wide and
throttled (answer counts ≤ 4/s, lobby updates coalesced) — this cut p99 answer
acknowledgement in 250-player rooms from 2.6 s to 37 ms. Graceful shutdown tells players
the server is restarting; `/ready` fails during shutdown; Railway draining set to 10 s.
Rooms reaped after inactivity; hard 6 h cap. Scoring is now 500–1000 points per correct
answer relative to the timer (previously 1000 + 50/second, which made timers inconsistent).

**Demo.** "Try a free demo" → pick one of four hand-checked quizzes (incl. one in Estonian)
→ host for a group (code + QR, up to 30 players) or a clearly labelled **solo preview**
(just you and the clock; no simulated players). No login, no credits, rate-limited, rooms
expire after 15 minutes idle. Ends with "Create a quiz on your own topic".

**Teacher review mode.** Optional at creation ("Let me check first"): the host can view and
edit questions/answers or remove questions before starting; players see "Host has seen
the questions". In the default surprise mode the review endpoint refuses, so the host
genuinely can't peek.

**UI.** New design system (`styles/tokens.js`, `components/ui.jsx`): warm paper/ink palette
from the logo's violet, self-hosted Bricolage Grotesque + Atkinson Hyperlegible (no Google
Fonts requests), light/dark themes, WCAG AA contrast enforced by a test, visible focus,
reduced-motion support, skip link, focus moved to new question headings, sparse screen-
reader announcements for the countdown. Answer colours (teal/wine/ochre/slate with
letters) avoid Kahoot's red/blue/yellow/green shapes. Rebuilt landing page, demo, create,
join, game screens, account and pricing. framer-motion removed; Supabase and Socket.IO load
on demand — initial JS 165 kB → 100 kB gzipped.

**Legal drafts** (`/privacy`, `/terms`, `/refunds`, `/contact`) written from the real data
flows and subprocessors; seller identity comes from build variables and is never invented.

**Operations.** Structured JSON logs with secret/email redaction; client error reporting;
anonymous funnel metrics; `/health` + `/ready`; `railway.json` health check and draining;
Node 22 non-root Docker image; CI runs all tests, audits and builds the image;
`db/queries/operations.sql` for funnel, cost and billing audits.

## 2. Test evidence

| Suite | Result | What it covers |
| --- | --- | --- |
| Backend `npm test` | **53 / 53 pass** | |
| · database (PGlite, real Postgres 18) | 9 | RLS: users read only own rows, cannot write grants/subscriptions/profiles; anon reads nothing; credit functions not executable by anon/authenticated; free-first then soonest-expiring; 6 parallel reservations with 2 credits → exactly 2 succeed, none negative; release exactly once; crash sweeper; grant/revoke idempotency; retention |
| · billing (signed webhooks + real AiUsageService on PGlite) | 13 | forged signature rejected; replay/duplicate events don't double-grant; SEPA waits for payment; failed grant retried not lost; current-API subscription grant + rollover expiry; proration doesn't grant; out-of-order events; refund (partial, replayed) and dispute; checkout consent/customer reuse/duplicate-subscription block; hidden plans; free→paid→failure refund with no room created; concurrent spend; anonymous AI refused; budget cap; account deletion |
| · game (real Socket.IO) | 19 | no correct answer before reveal; 10-char codes; duplicate taps; closed-round rejection; deadline grace; idempotent start/next and delayed "next"; host-only controls; reconnect restores answer; second tab; late join; host grace → temporary host → owner reclaims; reveal modes; room caps; code-guessing limit; leave; next game; review mode; shutdown notice; reaping |
| · question service | 12 | strict schema request; filtering; retry then honest failure; unsupported topic; moderation; auth-error no-retry; format fallback; no substitution; shuffle distribution; every demo question passes the AI checks |
| Frontend `npm test` | **31 / 31 pass** | landing copy has no unsupported claims; 10-char code entry; clock-offset countdown; failed answers never shown as locked; snapshots; plans/subscription copy; create page (allowance, failure keeps form, success, no-credits); token contrast light+dark; **axe: 0 violations** on landing, demo, join, legal, answer grid |
| Mutation check | pass | Re-introducing the old `invoice.subscription` read makes the subscription test fail. |
| Browser E2E (dev + production build) | pass | Desktop host + 375 px mobile player: demo room, manual code entry with lowercase/space, live answer counts, server-confirmed lock-in, reveal, leaderboard, **reload mid-question restores seat, answer and timer**, backend restart → honest "room not found" with recovery links, solo preview to the final screen, "play another" moves to a new room. Production build under the real CSP: fonts load, socket connects, answer round-trip works. |
| Load test (local, `scripts/loadtest.js`) | pass | 150 players/room: p99 ack 9 ms. 2 × 250 players: 0 failures, p99 ack 37 ms (2.6 s before throttling). 40 rooms × 25 = **1,000 concurrent players: 0 failures, 0 missed reveals, p99 ack 7 ms, 131 MB RSS**. |
| `npm audit --omit=dev` | backend 0; frontend 0 production issues | 2 moderate dev-only (vitest) remain; fix needs a major upgrade. |

Bugs found *during* this work and fixed: the second tab taking the host's seat (shared
storage); spinner layout; answer text collapsing in narrow tiles; low-contrast faded
answers; "You won!" on a solo run; host toast on own arrival; generated SQL `$$` quoting.

**Not verified — treat as unknown:**
- **Real AI generation.** The local `OPENAI_API_KEY` returns 401, so no real quiz was
  generated; token usage and cost per game are estimates, and it's unconfirmed that
  `gpt-5.6-sol` accepts strict JSON-schema output (there is an automatic fallback).
- **Stripe test mode end to end** (no test keys available): checkout, portal, real webhook
  delivery. Webhook handling is tested with correctly signed payloads and stubbed Stripe
  API calls.
- **Production Supabase state** (whether 001 matches what's deployed; existing grants).
- Google sign-in flow (Supabase not configured locally); signed-in UI covered by component
  tests only.
- Docker image build (Docker daemon unavailable here; CI builds it) and a real Railway deploy.
- Real phones (only emulated 375 px viewport), iOS Safari backgrounding/sleep, screen
  readers (automated axe only), multi-instance (unsupported by design).
- Load numbers come from a 16-core development machine with the load generator on the same
  host. Railway's shared vCPUs will be slower: the 150-per-room default is deliberately
  conservative. Re-run `loadtest.js` against staging before advertising larger rooms.

## 3. Remaining launch blockers (most severe first)

1. **Audit subscription renewals in production.** Run query 5 in
   `backend/db/queries/operations.sql` and compare with invoices in Stripe. Deploy, then
   `reconcile-stripe.js --days 30 --apply` repairs the last 30 days; older missed invoices
   need manual grants (query 7). Consider a goodwill note to affected subscribers.
2. **Seller identity.** EU/Estonian law requires the trader's name, registry code, address
   and email on the site. Set `VITE_LEGAL_*` and rebuild. The legal pages currently say the
   details are being finalised.
3. **Withdrawal-right confirmation on a durable medium.** Directive 2011/83/EU Art. 16(m)
   requires consent (done: checkbox), acknowledgement (done) *and* confirmation from the
   trader (Art. 8(7)). Enable `STRIPE_PACK_INVOICES=true` and add the footer text below to
   Stripe's invoice/receipt settings, or the refunds page's "shown on your receipt" is false.
   Footer text: *"You asked for your AI games to be added immediately and acknowledged that
   you lose your 14-day right of withdrawal once they are added."*
4. **Trademark risk: "Kazoot" vs "Kahoot!".** Similar name, same product category (live
   quiz games), and the original README called it "Kahoot-style". Original code and
   AI-written questions do not address a trademark claim. Get a trademark lawyer's view
   before spending on marketing — renaming later costs more. I have not renamed anything;
   brand strings are centralised in `frontend/src/lib/brand.js`, `index.html` and
   `manifest.json`, and "Kahoot" was removed from package descriptions and public copy.
5. **Legal review** of `/privacy`, `/terms`, `/refunds` (drafts, not advice): international
   transfer mechanisms per provider; children/school use (Estonia's age of digital consent
   is 13; players give only a nickname); the ODR sentence; liability cap. Accessibility:
   the European Accessibility Act exempts service providers that are microenterprises
   (fewer than 10 staff and ≤ €2 million turnover), which likely covers Kazoot today; the
   site targets WCAG 2.1 AA anyway (see test evidence).
6. **Real AI and Stripe test-mode runs** in a staging environment (DEPLOYMENT.md §5).
7. **Stripe customer portal** configured with plan switching disabled.
8. **Lower the AI budget caps** (e.g. `DAILY_OPENAI_BUDGET_USD=3`, `MONTHLY=30`); the
   documented 10/100 USD is large relative to current revenue.
9. **Accounting/VAT confirmation** (below).

## 4. Pricing recommendation and calculations

**Current offer (verified in code and on the live `/api/billing/catalog`, all configured):**
Free 3 AI games/month · Pack 20 €5 · Pack 60 €12 · Pack 150 €25 (12 months) · Plus €5/month
(30) · Pro €12/month (90), subscription games roll over one month.

**Competitors (official pricing pages, 26 Sept 2026; different products, so compare with care):**
- Kahoot! 360 (business, shown for EU): Pro Start €15/month billed annually (€180/yr),
  excl. tax, up to 50 participants; higher tiers €22–69/month. Personal plans redirected
  to the business page from here.
- Mentimeter: free with 50 participants/month; Basic €14/presenter/month billed yearly,
  excl. tax.
- AhaSlides: free up to 50 participants with 5 quiz questions per presentation; paid
  plans from about €7.25/month billed yearly; education from €2.75/month.
Kazoot's niche is *occasional* hosting without a subscription: a €5 pack is cheaper than
one month of any competitor subscription. None of them has the "host plays too" angle.

**Unit economics (per purchase, assuming half of the games are used):**

| Plan | Price | Stripe fee¹ | AI cost² | Contribution, not VAT-registered³ | …if VAT-registered (24%) |
| --- | --- | --- | --- | --- | --- |
| Pack 20 | €5 | €0.33 | €0.20 | **€4.32** | €3.39 |
| Pack 60 | €12 | €0.43 | €0.60 | **€10.61** | €8.36 |
| Pack 150 | €25 | €0.63 | €1.50 | **€22.13** | €17.43 |
| Plus / month | €5 | €0.36 | €0.30 | **€4.19** | €3.25 |
| Pro / month | €12 | €0.51 | €0.90 | **€10.23** | €7.97 |

¹ Stripe Estonia: 1.5% + €0.25 per EEA card; Stripe Billing +0.7% on subscriptions; UK and
non-EEA cards cost more; a dispute costs extra. ² Estimate €0.02 per AI game (~800 input +
~700 output tokens at the repo's configured $4/$20 per million) — **replace with the real
average from query 4**. ³ Also subtracts a 3% refund allowance. A free host using all 3
games costs about €0.06/month; 1,000 such hosts ≈ €60/month.

Fixed costs: Railway Hobby (~$5/month incl. usage for one small service), Supabase free
tier, domain ≈ €10–20/month in total. **Revenue ≠ profit:** the figures above are
contribution before income tax and the owner's time.

- **Cover €20/month:** about **5 Pack-20 purchases** (or 2 Pack-60, or 5 Plus subscribers).
- **€1,000/month contribution after ~€15 fixed costs:** e.g. 235 Pack-20 purchases, *or*
  96 Pack-60, *or* 100 Pro subscribers. A realistic mix — 60 Pack-20 + 20 Pack-60 + 6
  Pack-150 (one-time, must be re-won every month) + 50 Plus + 22 Pro (recurring) ≈ €1,200
  revenue, ≈ €1,020 contribution, ~160 paying customers a month. At an assumed 2–5% of
  active hosts paying (unvalidated), that needs roughly 3,000–8,000 monthly active hosts.

**Does 3 free games a month remove the reason to buy?** For the core "friends' quiz night"
user, mostly yes: one evening uses 1–3 quizzes. Free games cost almost nothing, so the
question is conversion, not cost. The purchase moment is "we want another round" or
regular hosting (teachers, weekly quiz nights, team leads).

**Recommendation (not applied — needs your approval; existing customers keep what they have):**
1. Keep **3 free/month** for now (it's promised on the live site and drives word of mouth)
   and measure: if fewer than ~2% of hosts who use all three buy within 30 days, test
   **2 free/month** for new accounts.
2. **Simplify to three paid options:** Pack 20 (€5, the impulse "one more round"),
   Pack 60 (€12, regular hosts/teachers), Pro (€12/month, heavy users). Hide Plus and
   Pack 150 for new buyers: `BILLING_VISIBLE_PLANS=credits_20,credits_60,pro_monthly`.
   Plus at €5/month gives the same price as Pack 20 but adds recurring-charge risk for a
   customer who probably hosts a few times a month.
3. Revisit prices only with data (query 3 and 4 after 1–2 months).

**Tax/accounting questions for an accountant:** trading form (FIE vs OÜ); Estonian VAT
registration is mandatory above €40,000 annual taxable supply (since 1 Jan 2025); EU
cross-border B2C digital services and the €10,000 EU-wide OSS threshold; how prices are
shown if registered (they're VAT-inclusive today); record keeping (the privacy page states
7 years for payment records — confirm).

## 5. Environment variables and safe setup

See **DEPLOYMENT.md §1** and `backend/.env.example` / `frontend/.env.example`. Rules:
secrets (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`) only as Railway service variables, never in `VITE_*`; test keys
and test price IDs in staging, live ones only in production; the server logs whether
billing is in `test` or `live` mode at startup and never logs key values.

## 6. Deployment, migration and rollback

See **DEPLOYMENT.md §4 and §6**. In short: back up → run `003_launch_hardening.sql`
(safe with the old version running) → deploy in a quiet hour (restarts end live games) →
smoke test → reconcile Stripe → audit subscriptions. Rollback = redeploy the previous
Railway deployment; no database rollback required. Never recreate the removed
`profiles_update_own` policy.

## 7. Owner checklist

- [ ] Run query 5; decide how to make affected subscribers whole.
- [ ] Provide seller name, registry code, address (and VAT number if any) → `VITE_LEGAL_*`.
- [ ] Stripe: invoice footer + `STRIPE_PACK_INVOICES=true`; configure the customer portal
      (no plan switching); add the webhook events listed in DEPLOYMENT.md.
- [ ] Provide Stripe **test** keys + test price IDs (and a working OpenAI key) for staging,
      so checkout, portal and real generation can be verified before merging.
- [ ] Decide on the "Kazoot" name after trademark advice.
- [ ] Approve or reject the plan simplification (`BILLING_VISIBLE_PLANS`) and free-tier test.
- [ ] Set budget caps (`DAILY_OPENAI_BUDGET_USD`, `MONTHLY_OPENAI_BUDGET_USD`).
- [ ] Have the legal pages reviewed; confirm the refund promise (unused games refundable
      within 14 days) is one you want to keep.
- [ ] Accountant: trading form, VAT registration, OSS.
- [ ] Confirm `support@kazoot.app` forwarding works; the site promises replies within 2
      business days.
- [ ] After deploy: check Supabase security advisors; set an uptime check on `/health`.

## Sources

- Stripe Estonia pricing: https://stripe.com/en-ee/pricing · Billing: https://stripe.com/en-ee/billing/pricing
- Railway deployments (SIGTERM, overlap, draining): https://docs.railway.com/reference/deployments · config: https://docs.railway.com/reference/config-as-code
- Consumer Rights Directive (consolidated): https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02011L0083-20220528
- European Accessibility Act (microenterprise exemption for services): https://eur-lex.europa.eu/eli/dir/2019/882/oj/eng
- Estonian VAT registration threshold: https://www.emta.ee/en/business-client/taxes-and-payment/value-added-tax/registration-vat-payer · rate 24% from 1 July 2025: https://www.emta.ee/en/business-client/taxes-and-payment/value-added-tax/vat-rates-and-supply-exempt-tax
- Competitors: https://kahoot360.com/pricing/ · https://www.mentimeter.com/plans · https://ahaslides.com/pricing/
