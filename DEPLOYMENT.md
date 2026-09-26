# Deploying Kazoot

Kazoot runs as **one Railway service** built from the `Dockerfile` (`railway.json` pins the
builder, the health check and shutdown timing). Supabase provides Postgres and Google
sign-in; Stripe handles payments.

## 1. Environment variables

Set in Railway → service → Variables. Full list with comments: `backend/.env.example`
(runtime, secret) and `frontend/.env.example` (build-time, public).

Required in production:

| Variable | Secret? | Notes |
| --- | --- | --- |
| `NODE_ENV=production` | no | |
| `FRONTEND_URL=https://kazoot.app` | no | CORS, checkout and portal return URLs |
| `CORS_ALLOWED_ORIGINS` | no | e.g. `https://www.kazoot.app` if that host is live |
| `TRUST_PROXY=1` | no | correct client IPs behind Railway's proxy (rate limits) |
| `OPENAI_API_KEY` | **yes** | |
| `OPENAI_MODEL` | no | default `gpt-5.6-sol` |
| `DAILY_OPENAI_BUDGET_USD`, `MONTHLY_OPENAI_BUDGET_USD` | no | hard caps; recommended 3 / 30 until revenue grows |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **yes** (key) | backend only — never in a `VITE_` variable |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | **yes** | `sk_test_`/`whsec_` in staging, live keys only in production |
| `STRIPE_*_PRICE_ID` (5) | no | must match the mode (test/live) of the secret key |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | no (public) | build-time; the anon key is designed to be public, RLS protects data |
| `VITE_SUPPORT_EMAIL` | no | |
| `VITE_LEGAL_SELLER_NAME`, `VITE_LEGAL_REGISTRY_CODE`, `VITE_LEGAL_ADDRESS` (+ `VITE_LEGAL_VAT_NUMBER` if registered) | no | shown on legal pages; required before selling |

Optional: `BILLING_VISIBLE_PLANS`, `STRIPE_PACK_INVOICES=true`, `MAX_PLAYERS_PER_SESSION`
(default 150), `HOST_GRACE_MS`, `DETAILED_HEALTH`, `DIAGNOSTICS_SECRET`.

Railway: keep **one replica**. `railway.json` sets `drainingSeconds: 10` so the server can
warn players before it stops (Railway's default is 0 seconds).

## 2. Supabase

1. Migrations, in order, in the SQL editor: `backend/db/001_ai_cost_controls.sql` (already
   applied in production), `002_plus_30_top_up.sql` (optional, one-off, already reviewed),
   **`003_launch_hardening.sql` (new — required by this release)**.
   003 is additive and idempotent; the currently deployed version keeps working after it runs.
2. Auth → URL configuration: Site URL `https://kazoot.app`; redirect URLs
   `https://kazoot.app/**` (and `https://www.kazoot.app/**` only if www is live).
3. After 003, check Database → Advisors (security) shows no RLS or function warnings for
   `public`.
4. Backups: the free plan keeps daily backups for a short period; confirm the current
   retention for your plan in the dashboard. Before any migration, export a backup
   (Database → Backups, or `pg_dump`).

## 3. Stripe

1. Webhook endpoint `https://kazoot.app/api/billing/webhook` with these events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `invoice.paid`, `invoice.payment_failed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`.
2. Customer portal (Settings → Billing → Customer portal): enable cancellation (at period
   end), payment-method update and invoice history. **Disable plan switching** — plan
   changes create proration invoices that intentionally grant nothing automatically.
3. Invoice/receipt footer: add the withdrawal-waiver confirmation text (see LAUNCH.md) and
   set `STRIPE_PACK_INVOICES=true` so pack buyers receive it by email.
4. Test everything in test mode first (section 5).

## 4. Release procedure

1. Quiet time: deploying restarts the process and **ends live games** (players see a
   restart message).
2. Back up the database.
3. Run `003_launch_hardening.sql` if not yet applied.
4. Merge and let Railway deploy. Watch logs for `server_started` and check
   `https://kazoot.app/health` → `{"status":"healthy"}` and `/ready`.
5. Smoke test: open `/demo`, run a solo preview to the end; join a demo room from a phone;
   sign in and create one AI quiz (costs one of your free games); open `/account`.
6. Replay recent Stripe events to repair subscription grants missed before this release:
   `node scripts/reconcile-stripe.js --days 30` (dry run) then `--apply`, from a Railway
   shell or locally with production variables. Then run query 5 in
   `backend/db/queries/operations.sql` and fix older gaps manually (query 7).

## 5. Staging / Stripe test mode

Create a second Railway environment with `sk_test_` keys, test price IDs, a test webhook
secret and (ideally) a separate Supabase project. Test cards: `4242 4242 4242 4242`
(success), `4000 0025 0000 3155` (3-D Secure), SEPA test IBANs for delayed payments.
Verify: pack purchase adds 20 games; subscription adds 30 and shows the renewal date;
cancelling in the portal shows "Cancelled — ends on …"; refund in the dashboard removes
unused games; `stripe trigger` events replay harmlessly.

## 6. Rollback

- **Code:** Railway → Deployments → redeploy the previous deployment. The previous
  version ignores the 003 columns/functions, so no database rollback is needed.
- **Database (only if 003 itself must be undone):** 003 drops one RLS policy
  (`profiles_update_own`, which let users edit their own `stripe_customer_id`); do not
  recreate it. Everything else it adds can stay. Never drop `credit_grants`, `usage_ledger`
  or `payments` — they hold customer entitlements.
- **Model change:** set `OPENAI_MODEL` back and redeploy.

## 7. Operations

- Logs are JSON lines (`event` field) in Railway. Useful filters: `level=error`,
  `stripe_webhook_failed`, `generation_failed`, `stale_reservations_released`,
  `client_error`, `metrics_rollup`.
- Health: `/health` (liveness; details with `DETAILED_HEALTH=true`), `/ready` (503 while
  shutting down). Diagnostics: `/diagnostics/sessions` with header
  `x-diagnostics-secret`.
- Suggested alerts (Railway observability or an external uptime check): `/health`
  non-200 for 2 minutes; any `stripe_webhook_failed`; `generation_failed` rate spikes;
  `budget_reached` errors.
- Capacity (see LAUNCH.md): tested to 1,000 concurrent players and 250 per room on a
  development machine; production cap defaults to 150 per room.
- Data retention runs daily (IP addresses 30 days, topics 12 months, events 13 months).
