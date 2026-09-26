#!/usr/bin/env node
// Replays Stripe's own event log through the webhook handlers. Use after a webhook
// outage, a bad deploy, or to repair subscription grants missed before the
// 2026 API-shape fix. Safe to run repeatedly: every handler is idempotent.
//
//   node scripts/reconcile-stripe.js --days 30            # dry run: counts only
//   node scripts/reconcile-stripe.js --days 30 --apply    # apply
//
// Needs STRIPE_SECRET_KEY, STRIPE_*_PRICE_ID, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Stripe keeps events for 30 days; older gaps need manual grants.
const { config } = require('../src/config');
const { AiUsageService } = require('../src/billing/aiUsageService');
const { StripeBillingService, HANDLED_EVENT_TYPES } = require('../src/billing/stripeBillingService');
const { createLogger } = require('../src/observability/logger');

async function main() {
  const args = process.argv.slice(2);
  const days = Math.min(30, Number(args[args.indexOf('--days') + 1]) || 7);
  const apply = args.includes('--apply');
  const logger = createLogger();

  if (!config.stripeSecretKey || !config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error('Set STRIPE_SECRET_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  const aiUsageService = new AiUsageService({ config });
  const billing = new StripeBillingService({ config, aiUsageService, logger });
  logger.info('reconcile_started', { days, apply, mode: billing.isTestMode() ? 'test' : 'live' });

  if (!apply) {
    const created = { gte: Math.floor(Date.now() / 1000) - days * 86400 };
    const counts = {};
    for await (const event of billing.client.events.list({ types: HANDLED_EVENT_TYPES, created, limit: 100 })) {
      counts[event.type] = (counts[event.type] || 0) + 1;
    }
    logger.info('reconcile_dry_run', { counts, note: 'Re-run with --apply to process these events.' });
    return;
  }

  const summary = await billing.reconcileRecentEvents({ sinceDays: days });
  logger.info('reconcile_finished', summary);
  if (summary.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
