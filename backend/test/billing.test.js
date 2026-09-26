// Billing and credits: signed Stripe webhooks, the real AiUsageService, and the
// real Postgres schema/functions (PGlite). Only Stripe's outbound API is stubbed.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const Stripe = require('stripe');
const { AiUsageService } = require('../src/billing/aiUsageService');
const { createSupabaseTestDb } = require('./helpers/supabaseTestDb');
const { createPgliteSupabaseClient } = require('./helpers/pgliteSupabaseClient');
const { api, fakeAuthService, startTestServer, TEST_USER } = require('./helpers/testServer');

const WEBHOOK_SECRET = 'whsec_test_secret';
const PRICES = {
  stripePlusPriceId: 'price_plus',
  stripeProPriceId: 'price_pro',
  stripeCreditPack20PriceId: 'price_pack20',
  stripeCreditPack60PriceId: 'price_pack60',
  stripeCreditPack150PriceId: 'price_pack150',
};
const DAY = 86_400;

function createFakeStripe(state) {
  const stripe = new Stripe('sk_test_fake_key_for_tests');
  stripe.checkout.sessions.listLineItems = async (id) => ({ data: [{ price: { id: state.lineItems[id] || 'price_pack20' } }] });
  stripe.checkout.sessions.create = async (params) => {
    state.checkoutCreates.push(params);
    return { id: `cs_${state.checkoutCreates.length}`, url: 'https://checkout.stripe.test/session' };
  };
  stripe.customers.create = async (params, options) => {
    state.customerCreates.push({ params, options });
    return { id: `cus_${state.customerCreates.length}` };
  };
  stripe.subscriptions.retrieve = async (id) => {
    if (!state.subscriptions[id]) throw new Error(`No such subscription ${id}`);
    return state.subscriptions[id];
  };
  stripe.refunds.list = async ({ charge }) => ({ data: state.refunds[charge] || [] });
  stripe.invoicePayments.list = async ({ invoice }) => ({ data: [{ payment: { payment_intent: `pi_for_${invoice}` } }] });
  stripe.billingPortal.sessions.create = async (params) => ({ url: `https://billing.stripe.test/${params.customer}` });
  return stripe;
}

async function setup({ config = {} } = {}) {
  const { db, createUser } = await createSupabaseTestDb();
  await createUser(TEST_USER.id, TEST_USER.email);
  const state = { lineItems: {}, subscriptions: {}, refunds: {}, checkoutCreates: [], customerCreates: [] };
  const fullConfig = {
    stripeSecretKey: 'sk_test_fake_key_for_tests',
    stripeWebhookSecret: WEBHOOK_SECRET,
    freeAiGamesPerMonth: 3,
    aiCreditCostPerQuiz: 1,
    maxAiGenerationsPerUserPerHour: 100,
    maxAiGenerationsPerIpPerHour: 100,
    dailyOpenAiBudgetUsd: 100,
    monthlyOpenAiBudgetUsd: 1000,
    openAiEstInputCostPer1M: 4,
    openAiEstOutputCostPer1M: 20,
    ...PRICES,
    ...config,
  };
  const aiUsageService = new AiUsageService({ config: fullConfig, client: createPgliteSupabaseClient(db) });
  const stripe = createFakeStripe(state);
  const runtime = await startTestServer({
    config: fullConfig,
    aiUsageService,
    stripeClient: stripe,
    authService: fakeAuthService(),
  });
  return { db, state, stripe, runtime, aiUsageService };
}

async function sendWebhook(runtime, stripe, event, { secret = WEBHOOK_SECRET } = {}) {
  const payload = JSON.stringify({ object: 'event', api_version: '2026-04-22.dahlia', livemode: false, created: Math.floor(Date.now() / 1000), ...event });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const response = await fetch(`${runtime.baseUrl}/api/billing/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature },
    body: payload,
  });
  return response.status;
}

function packCheckout({ id = 'cs_pack', paymentStatus = 'paid', eventId = `evt_${randomUUID()}`, type = 'checkout.session.completed' } = {}) {
  return {
    id: eventId,
    type,
    data: {
      object: {
        id,
        object: 'checkout.session',
        mode: 'payment',
        payment_status: paymentStatus,
        customer: 'cus_existing',
        client_reference_id: TEST_USER.id,
        payment_intent: `pi_${id}`,
        amount_total: 500,
        currency: 'eur',
        created: Math.floor(Date.now() / 1000),
        metadata: { userId: TEST_USER.id, planId: 'credits_20' },
      },
    },
  };
}

async function grants(db) {
  const { rows } = await db.query('select source_id, grant_type, original_credits, remaining_credits, expires_at from credit_grants order by created_at');
  return rows;
}

test('pack purchase: credits come only from a verified, paid webhook and replays never double-grant', async () => {
  const { db, state, stripe, runtime } = await setup();
  try {
    assert.equal(await sendWebhook(runtime, stripe, packCheckout(), { secret: 'whsec_wrong' }), 400, 'forged signature');
    assert.equal((await grants(db)).length, 0);

    const event = packCheckout();
    assert.equal(await sendWebhook(runtime, stripe, event), 200);
    assert.equal(await sendWebhook(runtime, stripe, event), 200, 'exact replay');
    assert.equal(await sendWebhook(runtime, stripe, packCheckout({ type: 'checkout.session.async_payment_succeeded' })), 200);

    const rows = await grants(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].original_credits, 20);
    const monthsValid = (new Date(rows[0].expires_at) - Date.now()) / (30 * DAY * 1000);
    assert.ok(monthsValid > 11.5 && monthsValid < 12.5, 'packs are valid for 12 months');

    state.lineItems.cs_tampered = 'price_someone_elses';
    await sendWebhook(runtime, stripe, packCheckout({ id: 'cs_tampered' }));
    assert.equal((await grants(db)).length, 1, 'unknown price grants nothing');
  } finally {
    await runtime.close();
  }
});

test('delayed payment methods grant only after the payment succeeds', async () => {
  const { db, stripe, runtime } = await setup();
  try {
    await sendWebhook(runtime, stripe, packCheckout({ id: 'cs_sepa', paymentStatus: 'unpaid' }));
    assert.equal((await grants(db)).length, 0);
    await sendWebhook(runtime, stripe, packCheckout({ id: 'cs_sepa', type: 'checkout.session.async_payment_succeeded' }));
    assert.equal((await grants(db)).length, 1);
  } finally {
    await runtime.close();
  }
});

test('a failed grant is retried by Stripe instead of being lost', async () => {
  const { db, stripe, runtime, aiUsageService } = await setup();
  try {
    const original = aiUsageService.grantCredits.bind(aiUsageService);
    let failNext = true;
    aiUsageService.grantCredits = async (args) => {
      if (failNext) {
        failNext = false;
        throw new Error('database briefly unavailable');
      }
      return original(args);
    };
    const event = packCheckout();
    assert.equal(await sendWebhook(runtime, stripe, event), 500, 'Stripe must see a failure and retry');
    assert.equal(await sendWebhook(runtime, stripe, event), 200);
    assert.equal((await grants(db)).length, 1);
  } finally {
    await runtime.close();
  }
});

function subscription({ id = 'sub_1', status = 'active', priceId = 'price_plus', periodEnd = Math.floor(Date.now() / 1000) + 30 * DAY, cancelAtPeriodEnd = false } = {}) {
  // Current API shape: the billing period lives on the subscription item.
  return {
    id,
    object: 'subscription',
    customer: 'cus_sub',
    status,
    cancel_at_period_end: cancelAtPeriodEnd,
    metadata: { userId: TEST_USER.id, planId: 'plus_monthly' },
    items: { data: [{ price: { id: priceId }, current_period_start: periodEnd - 30 * DAY, current_period_end: periodEnd }] },
  };
}

function invoicePaid({ id = 'in_1', billingReason = 'subscription_create', subscriptionId = 'sub_1' } = {}) {
  // Current API shape: no top-level invoice.subscription.
  return {
    id: `evt_${randomUUID()}`,
    type: 'invoice.paid',
    data: {
      object: {
        id,
        object: 'invoice',
        billing_reason: billingReason,
        amount_paid: 500,
        currency: 'eur',
        parent: { type: 'subscription_details', subscription_details: { subscription: subscriptionId } },
      },
    },
  };
}

test('subscriptions: current Stripe API shape grants monthly credits with one period of rollover', async () => {
  const { db, state, stripe, runtime } = await setup();
  try {
    const periodEnd = Math.floor(Date.now() / 1000) + 30 * DAY;
    state.subscriptions.sub_1 = subscription({ periodEnd });
    assert.equal(await sendWebhook(runtime, stripe, invoicePaid()), 200);

    const [grant] = await grants(db);
    assert.equal(grant.original_credits, 30);
    assert.equal(grant.grant_type, 'subscription');
    const expectedExpiry = new Date(periodEnd * 1000);
    expectedExpiry.setUTCMonth(expectedExpiry.getUTCMonth() + 1);
    assert.equal(new Date(grant.expires_at).toISOString(), expectedExpiry.toISOString());

    const { rows: [sub] } = await db.query('select tier, status, plan_id, cancel_at_period_end, current_period_end from subscriptions');
    assert.equal(sub.tier, 'plus');
    assert.equal(sub.status, 'active');
    assert.equal(sub.plan_id, 'plus_monthly');

    // A proration invoice after a plan change does not grant a second allowance.
    await sendWebhook(runtime, stripe, invoicePaid({ id: 'in_proration', billingReason: 'subscription_update' }));
    // The next month's renewal does.
    await sendWebhook(runtime, stripe, invoicePaid({ id: 'in_2', billingReason: 'subscription_cycle' }));
    assert.deepEqual((await grants(db)).map((row) => row.source_id), ['in_1', 'in_2']);
  } finally {
    await runtime.close();
  }
});

test('subscription events are applied from Stripe’s current state, so out-of-order events are harmless', async () => {
  const { db, state, stripe, runtime } = await setup();
  try {
    state.subscriptions.sub_1 = subscription({ status: 'canceled' });
    // A stale "updated: active" event arrives after the cancellation.
    await sendWebhook(runtime, stripe, {
      id: 'evt_stale',
      type: 'customer.subscription.updated',
      data: { object: { ...subscription({ status: 'active' }) } },
    });
    const { rows: [sub] } = await db.query('select tier, status from subscriptions');
    assert.equal(sub.status, 'canceled');
    assert.equal(sub.tier, 'free');

    // Cancellation scheduled for period end is shown to the customer.
    state.subscriptions.sub_1 = subscription({ status: 'active', cancelAtPeriodEnd: true });
    await sendWebhook(runtime, stripe, { id: 'evt_cancel', type: 'customer.subscription.updated', data: { object: subscription() } });
    const usage = await api(runtime.baseUrl, '/api/me/usage', { method: 'GET', headers: { authorization: 'Bearer good' } });
    assert.equal(usage.body.usage.subscription.cancelAtPeriodEnd, true);
    assert.equal(usage.body.usage.tier, 'plus');
  } finally {
    await runtime.close();
  }
});

test('refunds and disputes remove unused credits exactly once', async () => {
  const { db, state, stripe, runtime } = await setup();
  try {
    await sendWebhook(runtime, stripe, packCheckout({ id: 'cs_refund' }));
    const charge = { id: 'ch_1', object: 'charge', amount: 500, amount_refunded: 250, payment_intent: 'pi_cs_refund' };
    state.refunds.ch_1 = [{ id: 're_1', amount: 250, status: 'succeeded' }];
    const refundEvent = { id: 'evt_refund_1', type: 'charge.refunded', data: { object: charge } };
    await sendWebhook(runtime, stripe, refundEvent);
    await sendWebhook(runtime, stripe, refundEvent);
    assert.equal((await grants(db))[0].remaining_credits, 10, 'half refund removes half the credits, once');

    await sendWebhook(runtime, stripe, packCheckout({ id: 'cs_dispute' }));
    await sendWebhook(runtime, stripe, {
      id: 'evt_dispute',
      type: 'charge.dispute.created',
      data: { object: { id: 'dp_1', object: 'dispute', amount: 500, payment_intent: 'pi_cs_dispute' } },
    });
    const disputed = (await grants(db)).find((row) => row.source_id === 'cs_dispute');
    assert.equal(disputed.remaining_credits, 0);
  } finally {
    await runtime.close();
  }
});

test('checkout: requires consent, reuses one Stripe customer, and blocks a second subscription', async () => {
  const { state, stripe, runtime, db } = await setup();
  const auth = { authorization: 'Bearer good' };
  try {
    const noConsent = await api(runtime.baseUrl, '/api/billing/checkout', { headers: auth, body: { planId: 'credits_20' } });
    assert.equal(noConsent.status, 400);

    const anonymous = await api(runtime.baseUrl, '/api/billing/checkout', { body: { planId: 'credits_20', acceptedImmediateSupply: true } });
    assert.equal(anonymous.status, 401);

    for (let index = 0; index < 2; index += 1) {
      const ok = await api(runtime.baseUrl, '/api/billing/checkout', { headers: auth, body: { planId: 'credits_20', acceptedImmediateSupply: true } });
      assert.equal(ok.status, 200);
    }
    assert.equal(state.customerCreates.length, 1, 'one Stripe customer per user');
    assert.equal(state.checkoutCreates[1].customer, 'cus_1');
    assert.equal(state.checkoutCreates[0].metadata.userId, TEST_USER.id);
    assert.equal(state.checkoutCreates[0].customer_email, undefined);

    state.subscriptions.sub_1 = subscription();
    await sendWebhook(runtime, stripe, invoicePaid());
    const second = await api(runtime.baseUrl, '/api/billing/checkout', { headers: auth, body: { planId: 'pro_monthly', acceptedImmediateSupply: true } });
    assert.equal(second.status, 409);
    assert.equal(second.body.code, 'subscription_exists');

    const portal = await api(runtime.baseUrl, '/api/billing/portal', { headers: auth, body: {} });
    assert.equal(portal.status, 200);
    const { rows: [profile] } = await db.query('select stripe_customer_id from profiles');
    assert.ok(portal.body.url.endsWith(profile.stripe_customer_id));
  } finally {
    await runtime.close();
  }
});

test('hidden plans cannot be bought, but existing buyers keep their entitlements', async () => {
  const { db, stripe, runtime } = await setup({ config: { billingVisiblePlans: 'credits_20,plus_monthly' } });
  try {
    const catalog = await api(runtime.baseUrl, '/api/billing/catalog', { method: 'GET' });
    assert.deepEqual(catalog.body.plans.map((plan) => plan.id), ['credits_20', 'plus_monthly']);
    const hidden = await api(runtime.baseUrl, '/api/billing/checkout', {
      headers: { authorization: 'Bearer good' },
      body: { planId: 'credits_150', acceptedImmediateSupply: true },
    });
    assert.equal(hidden.status, 400);

    const event = packCheckout({ id: 'cs_old_150' });
    event.data.object.metadata.planId = 'credits_150';
    const { state } = { state: null };
    stripe.checkout.sessions.listLineItems = async () => ({ data: [{ price: { id: 'price_pack150' } }] });
    await sendWebhook(runtime, stripe, event);
    assert.equal((await grants(db))[0].original_credits, 150);
  } finally {
    await runtime.close();
  }
});

function stubGeneration(runtime, behaviour) {
  runtime.questionService.hasOpenAI = () => true;
  runtime.questionService.generateQuiz = async ({ topic, language }) => {
    const outcome = await behaviour();
    if (outcome instanceof Error) throw outcome;
    const demo = runtime.questionService.getDemoQuiz('space');
    return { ...demo, topic, language, source: 'openai', usage: { inputTokens: 900, outputTokens: 1400, attempts: 1 } };
  };
}

async function createAiGame(runtime, topic = 'Roman history') {
  return api(runtime.baseUrl, '/api/create-session', { headers: { authorization: 'Bearer good' }, body: { topic } });
}

test('AI games: free quota first, then paid credits; failures give the game back and create no room', async () => {
  const { db, stripe, runtime } = await setup({ config: { freeAiGamesPerMonth: 1 } });
  try {
    await sendWebhook(runtime, stripe, packCheckout());
    let fail = false;
    stubGeneration(runtime, () => {
      if (fail) {
        const error = new Error('provider timeout');
        error.userFacing = true;
        error.status = 502;
        error.code = 'provider_unavailable';
        error.userMessage = 'The AI service isn’t responding right now. You were not charged.';
        error.usage = { inputTokens: 900, outputTokens: 0 };
        return error;
      }
      return null;
    });

    assert.equal((await createAiGame(runtime)).status, 200);
    assert.equal((await grants(db))[0].remaining_credits, 20, 'free game used first');
    assert.equal((await createAiGame(runtime)).status, 200);
    assert.equal((await grants(db))[0].remaining_credits, 19);

    fail = true;
    const roomsBefore = runtime.store.sessions.size;
    const failed = await createAiGame(runtime);
    assert.equal(failed.status, 502);
    assert.match(failed.body.error, /not charged/);
    assert.equal((await grants(db))[0].remaining_credits, 19, 'failed generation restores the credit');
    assert.equal(runtime.store.sessions.size, roomsBefore, 'no room with substitute questions');

    const { rows } = await db.query(`select status, charge_mode, estimated_cost_usd::float as cost from quiz_generations order by created_at`);
    assert.deepEqual(rows.map((row) => [row.status, row.charge_mode]), [
      ['succeeded', 'free_quota'],
      ['succeeded', 'paid_credit'],
      ['refunded', 'paid_credit'],
    ]);
    assert.ok(rows[2].cost > 0, 'tokens spent on failed attempts still count toward the budget');

    const usage = await api(runtime.baseUrl, '/api/me/usage', { method: 'GET', headers: { authorization: 'Bearer good' } });
    assert.equal(usage.body.usage.freeRemainingThisMonth, 0);
    assert.equal(usage.body.usage.credits, 19);
    assert.equal(usage.body.usage.grants[0].remainingCredits, 19);
  } finally {
    await runtime.close();
  }
});

test('AI games: concurrent requests cannot spend more credits than exist', async () => {
  const { db, stripe, runtime } = await setup({ config: { freeAiGamesPerMonth: 0 } });
  try {
    await sendWebhook(runtime, stripe, packCheckout());
    await db.query(`update credit_grants set remaining_credits = 2`);
    stubGeneration(runtime, () => new Promise((resolve) => setTimeout(resolve, 30)));
    const results = await Promise.all(Array.from({ length: 6 }, () => createAiGame(runtime)));
    assert.equal(results.filter((r) => r.status === 200).length, 2);
    assert.ok(results.filter((r) => r.status !== 200).every((r) => r.status === 402));
    assert.equal((await grants(db))[0].remaining_credits, 0);
  } finally {
    await runtime.close();
  }
});

test('anonymous visitors cannot create AI games, and nobody gets substitute questions for their topic', async () => {
  const { runtime } = await setup();
  try {
    stubGeneration(runtime, () => null);
    const anonymous = await api(runtime.baseUrl, '/api/create-session', { body: { topic: 'Estonian history' } });
    assert.equal(anonymous.status, 401);
    assert.equal(runtime.store.sessions.size, 0);
  } finally {
    await runtime.close();
  }
});

test('the daily AI budget cap stops generation before any provider call', async () => {
  const { db, runtime } = await setup({ config: { dailyOpenAiBudgetUsd: 0.01 } });
  try {
    let called = 0;
    stubGeneration(runtime, () => {
      called += 1;
    });
    await db.query(
      `insert into quiz_generations (user_id, topic, language, model, source, status, estimated_cost_usd) values ($1, 't', 'English', 'm', 'openai', 'failed', 0.02)`,
      [TEST_USER.id]
    );
    const blocked = await createAiGame(runtime);
    assert.equal(blocked.status, 503);
    assert.match(blocked.body.error, /credits are untouched/);
    assert.equal(called, 0);
  } finally {
    await runtime.close();
  }
});

test('account deletion is refused while a subscription is active', async () => {
  const { state, stripe, runtime } = await setup();
  try {
    state.subscriptions.sub_1 = subscription();
    await sendWebhook(runtime, stripe, invoicePaid());
    const refused = await api(runtime.baseUrl, '/api/me', { method: 'DELETE', headers: { authorization: 'Bearer good' } });
    assert.equal(refused.status, 409);
    assert.equal(runtime.authService.deleted.length, 0);

    state.subscriptions.sub_1 = subscription({ status: 'canceled' });
    await sendWebhook(runtime, stripe, { id: 'evt_del', type: 'customer.subscription.deleted', data: { object: subscription({ status: 'canceled' }) } });
    const deleted = await api(runtime.baseUrl, '/api/me', { method: 'DELETE', headers: { authorization: 'Bearer good' } });
    assert.equal(deleted.status, 200);
    assert.deepEqual(runtime.authService.deleted, [TEST_USER.id]);
  } finally {
    await runtime.close();
  }
});
