const Stripe = require('stripe');
const { PRICE_CATALOG, getVisiblePlanIds, findPlanByPriceId } = require('./plans');
const { UserFacingError } = require('../errors');

// Entitlements are granted only from verified webhooks (or the reconciliation
// script replaying Stripe's own event log), never from the checkout redirect.
// Every handler is idempotent: grants are keyed by Stripe object id and
// revocations by refund/dispute id, so replays and retries are harmless.

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);
const BLOCKING_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due', 'incomplete', 'unpaid']);
const GRANTING_BILLING_REASONS = new Set(['subscription_create', 'subscription_cycle']);

const HANDLED_EVENT_TYPES = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'charge.refunded',
  'charge.dispute.created',
];

function addMonthsIso(dateInput, months) {
  const date = dateInput ? new Date(dateInput) : new Date();
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString();
}

function stripeTimestampToIso(timestamp) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function idOf(value) {
  return typeof value === 'string' ? value : value?.id || null;
}

// Handles both the current API shape (period on the item) and older ones.
function getSubscriptionPeriod(subscription) {
  const item = subscription.items?.data?.[0] || {};
  return {
    start: stripeTimestampToIso(item.current_period_start ?? subscription.current_period_start),
    end: stripeTimestampToIso(item.current_period_end ?? subscription.current_period_end),
  };
}

function getInvoiceSubscriptionId(invoice) {
  return idOf(invoice.parent?.subscription_details?.subscription) || idOf(invoice.subscription);
}

class StripeBillingService {
  constructor({ config, aiUsageService, client = undefined, logger = null }) {
    this.config = config;
    this.aiUsageService = aiUsageService;
    this.client = client !== undefined ? client : config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;
    this.logger = logger || { info() {}, warn() {}, error() {} };
  }

  isConfigured() {
    return Boolean(this.client);
  }

  isTestMode() {
    return String(this.config.stripeSecretKey || '').startsWith('sk_test_');
  }

  getCatalog() {
    const visible = getVisiblePlanIds(this.config);
    return visible.map((id) => {
      const item = PRICE_CATALOG[id];
      return {
        id,
        name: item.name,
        mode: item.mode,
        tier: item.tier,
        credits: item.credits,
        amountCents: item.amountCents,
        currency: item.currency,
        interval: item.interval,
        validityMonths: item.validityMonths || null,
        rolloverPeriods: item.rolloverPeriods || 0,
        pricePerAiGameCents: Math.round(item.amountCents / item.credits),
        configured: Boolean(this.client && this.config[item.envKey]),
      };
    });
  }

  resolvePlan(planId, priceId) {
    const byPrice = findPlanByPriceId(this.config, priceId);
    if (byPrice) {
      return byPrice;
    }
    // A plan id in metadata is only trusted when its configured price matches.
    const byId = PRICE_CATALOG[planId];
    if (byId && priceId && this.config[byId.envKey] === priceId) {
      return { id: planId, ...byId };
    }
    return null;
  }

  // ------------------------------------------------------------- customers

  async getOrCreateCustomer(user) {
    const existing =
      (await this.aiUsageService.getStripeCustomerId(user.id)) ||
      (await this.aiUsageService.getSubscription(user.id))?.stripeCustomerId;
    if (existing) {
      await this.aiUsageService.setStripeCustomerId(user.id, existing);
      return existing;
    }

    const customer = await this.client.customers.create(
      { email: user.email || undefined, metadata: { userId: user.id } },
      { idempotencyKey: `kazoot-customer-${user.id}` }
    );
    await this.aiUsageService.setStripeCustomerId(user.id, customer.id);
    return customer.id;
  }

  async createCheckoutSession({ user, planId, acceptedImmediateSupply }) {
    if (!this.client) {
      throw new UserFacingError('Payments are not available right now.', { status: 503 });
    }

    if (!getVisiblePlanIds(this.config).includes(planId) || !PRICE_CATALOG[planId]) {
      throw new UserFacingError('This plan is not available.');
    }
    const plan = PRICE_CATALOG[planId];
    const priceId = this.config[plan.envKey];
    if (!priceId) {
      throw new UserFacingError('This plan is not available yet.');
    }

    if (acceptedImmediateSupply !== true) {
      throw new UserFacingError('Please confirm that your AI games can be added straight away.');
    }

    if (plan.mode === 'subscription') {
      const current = await this.aiUsageService.getSubscription(user.id);
      if (current && BLOCKING_SUBSCRIPTION_STATUSES.has(current.status)) {
        throw new UserFacingError('You already have a subscription. Use “Manage billing” to change or cancel it.', {
          code: 'subscription_exists',
          status: 409,
        });
      }
    }

    const customerId = await this.getOrCreateCustomer(user);
    const metadata = {
      userId: user.id,
      planId,
      credits: String(plan.credits),
      acceptedImmediateSupplyAt: new Date().toISOString(),
    };
    const baseUrl = this.config.frontendUrl || 'http://localhost:3000';

    const session = await this.client.checkout.sessions.create({
      mode: plan.mode,
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: this.config.billingSuccessUrl || `${baseUrl}/account?checkout=success`,
      cancel_url: this.config.billingCancelUrl || `${baseUrl}/account?checkout=cancelled`,
      metadata,
      ...(plan.mode === 'subscription'
        ? { subscription_data: { metadata } }
        : { payment_intent_data: { metadata } }),
      custom_text: {
        submit: {
          message:
            plan.mode === 'subscription'
              ? `Renews monthly until you cancel. ${plan.credits} AI games are added after each successful payment.`
              : `One-time payment. ${plan.credits} AI games are added after payment and stay valid for ${plan.validityMonths} months.`,
        },
      },
    });

    return { url: session.url };
  }

  async createPortalSession({ user }) {
    if (!this.client) {
      throw new UserFacingError('Payments are not available right now.', { status: 503 });
    }

    const customerId =
      (await this.aiUsageService.getStripeCustomerId(user.id)) ||
      (await this.aiUsageService.getSubscription(user.id))?.stripeCustomerId;
    if (!customerId) {
      throw new UserFacingError('There is no billing history on this account yet.', { status: 404 });
    }

    const baseUrl = this.config.frontendUrl || 'http://localhost:3000';
    const session = await this.client.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/account`,
    });
    return { url: session.url };
  }

  // -------------------------------------------------------------- webhooks

  constructWebhookEvent(rawBody, signature) {
    if (!this.client || !this.config.stripeWebhookSecret) {
      throw new Error('Stripe webhook is not configured.');
    }

    return this.client.webhooks.constructEvent(rawBody, signature, this.config.stripeWebhookSecret);
  }

  async handleWebhookEvent(event) {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return this.handleCheckoutPaid(event);
      case 'checkout.session.async_payment_failed':
        return this.recordEvent(event, event.data.object.id, event.data.object.metadata?.userId, 'async_payment_failed');
      case 'invoice.paid':
        return this.handleInvoicePaid(event);
      case 'invoice.payment_failed':
        return this.handleInvoicePaymentFailed(event);
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        return this.syncSubscription(event.data.object.id);
      case 'charge.refunded':
        return this.handleChargeRefunded(event);
      case 'charge.dispute.created':
        return this.handleDisputeCreated(event);
      default:
        return undefined;
    }
  }

  async recordEvent(event, objectId, userId, status, metadata = {}) {
    const object = event.data.object;
    return this.aiUsageService.recordPayment({
      stripeEventId: event.id,
      stripeObjectId: objectId,
      userId: userId || null,
      amountTotal: object.amount_total ?? object.amount_paid ?? object.amount ?? null,
      currency: object.currency || null,
      status,
      metadata,
    });
  }

  async handleCheckoutPaid(event) {
    const session = event.data.object;
    const userId = session.metadata?.userId || session.client_reference_id;
    if (!userId) {
      this.logger.warn('stripe_checkout_without_user', { sessionId: session.id });
      return;
    }

    const customerId = idOf(session.customer);
    if (customerId && !(await this.aiUsageService.getStripeCustomerId(userId))) {
      await this.aiUsageService.setStripeCustomerId(userId, customerId);
    }

    if (session.mode === 'subscription') {
      // Credits for subscriptions come from invoice.paid.
      const subscriptionId = idOf(session.subscription);
      if (subscriptionId) {
        await this.syncSubscription(subscriptionId, userId);
      }
      await this.recordEvent(event, session.id, userId, session.payment_status || 'completed', {
        planId: session.metadata?.planId || null,
      });
      return;
    }

    if (!['paid', 'no_payment_required'].includes(session.payment_status)) {
      // Delayed payment methods: wait for checkout.session.async_payment_succeeded.
      await this.recordEvent(event, session.id, userId, session.payment_status || 'unpaid', {
        planId: session.metadata?.planId || null,
      });
      return;
    }

    const lineItems = await this.client.checkout.sessions.listLineItems(session.id, { limit: 10 });
    const priceId = lineItems.data.map((item) => item.price?.id).find(Boolean);
    const plan = this.resolvePlan(session.metadata?.planId, priceId);
    if (!plan || plan.mode !== 'payment') {
      this.logger.warn('stripe_checkout_unknown_price', { sessionId: session.id, priceId });
      return;
    }

    const paymentIntentId = idOf(session.payment_intent);
    const granted = await this.aiUsageService.grantCredits({
      userId,
      credits: plan.credits,
      reason: 'stripe_ai_game_pack',
      sourceId: session.id,
      grantType: 'pack',
      expiresAt: addMonthsIso(stripeTimestampToIso(session.created) || new Date(), plan.validityMonths || 12),
      metadata: { planId: plan.id, paymentIntentId },
    });
    await this.recordEvent(event, session.id, userId, 'paid', {
      planId: plan.id,
      paymentIntentId,
      grantSourceId: session.id,
      credits: plan.credits,
    });
    this.logger.info('stripe_pack_granted', { sessionId: session.id, planId: plan.id, newlyGranted: granted });
  }

  async findInvoicePaymentIntent(invoice) {
    const legacy = idOf(invoice.payment_intent);
    if (legacy) {
      return legacy;
    }
    try {
      const payments = await this.client.invoicePayments.list({ invoice: invoice.id, limit: 3 });
      return payments.data.map((payment) => idOf(payment.payment?.payment_intent)).find(Boolean) || null;
    } catch (error) {
      this.logger.warn('stripe_invoice_payment_lookup_failed', { invoiceId: invoice.id, message: error.message });
      return null;
    }
  }

  async handleInvoicePaid(event) {
    const invoice = event.data.object;
    const subscriptionId = getInvoiceSubscriptionId(invoice);
    if (!subscriptionId) {
      return;
    }

    const synced = await this.syncSubscription(subscriptionId);
    if (!synced?.userId || !synced.plan) {
      this.logger.warn('stripe_invoice_unmatched', { invoiceId: invoice.id, subscriptionId });
      return;
    }

    const billingReason = invoice.billing_reason || null;
    if (!GRANTING_BILLING_REASONS.has(billingReason)) {
      // e.g. proration after a plan change: no automatic grant; see DEPLOYMENT.md.
      await this.recordEvent(event, invoice.id, synced.userId, 'paid_no_grant', { billingReason, subscriptionId });
      this.logger.warn('stripe_invoice_paid_without_grant', { invoiceId: invoice.id, billingReason });
      return;
    }

    const { plan, period, userId } = synced;
    const paymentIntentId = await this.findInvoicePaymentIntent(invoice);
    const periodEnd = period.end || addMonthsIso(new Date(), 1);
    await this.aiUsageService.grantCredits({
      userId,
      credits: plan.credits,
      reason: 'stripe_subscription_ai_games',
      sourceId: invoice.id,
      grantType: 'subscription',
      expiresAt: addMonthsIso(periodEnd, plan.rolloverPeriods ?? 1),
      metadata: {
        planId: plan.id,
        subscriptionId,
        paymentIntentId,
        currentPeriodStart: period.start,
        currentPeriodEnd: periodEnd,
        rollover: 'one_extra_billing_period',
      },
    });
    await this.recordEvent(event, invoice.id, userId, 'paid', {
      planId: plan.id,
      subscriptionId,
      paymentIntentId,
      grantSourceId: invoice.id,
      billingReason,
      credits: plan.credits,
    });
  }

  async handleInvoicePaymentFailed(event) {
    const invoice = event.data.object;
    const subscriptionId = getInvoiceSubscriptionId(invoice);
    const synced = subscriptionId ? await this.syncSubscription(subscriptionId) : null;
    await this.recordEvent(event, invoice.id, synced?.userId, 'payment_failed', { subscriptionId });
  }

  // Always reads the current subscription from Stripe, so event order does not matter.
  async syncSubscription(subscriptionId, fallbackUserId = null) {
    const subscription = await this.client.subscriptions.retrieve(subscriptionId);
    const customerId = idOf(subscription.customer);
    const userId =
      subscription.metadata?.userId ||
      fallbackUserId ||
      (await this.aiUsageService.findUserIdByStripeCustomer(customerId));
    if (!userId) {
      this.logger.warn('stripe_subscription_without_user', { subscriptionId });
      return null;
    }

    const priceId = subscription.items?.data?.[0]?.price?.id;
    const plan = this.resolvePlan(subscription.metadata?.planId, priceId);
    const period = getSubscriptionPeriod(subscription);
    const isActive = ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status);

    // A user who cancelled and later re-subscribed must not have the new
    // subscription overwritten by a late event about the old one.
    const current = await this.aiUsageService.getSubscription(userId);
    if (
      current?.stripeSubscriptionId &&
      current.stripeSubscriptionId !== subscription.id &&
      ACTIVE_SUBSCRIPTION_STATUSES.has(current.status) &&
      !isActive
    ) {
      return { userId, plan, period, subscription, skipped: true };
    }

    await this.aiUsageService.upsertSubscription({
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      tier: isActive && plan ? plan.tier : 'free',
      planId: plan?.id || null,
      status: subscription.status,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end || subscription.cancel_at),
    });

    if (customerId && !(await this.aiUsageService.getStripeCustomerId(userId))) {
      await this.aiUsageService.setStripeCustomerId(userId, customerId);
    }

    return { userId, plan, period, subscription };
  }

  async handleChargeRefunded(event) {
    const charge = event.data.object;
    const payment = await this.aiUsageService.findPaymentByPaymentIntent(idOf(charge.payment_intent));
    if (!payment) {
      this.logger.warn('stripe_refund_unmatched', { chargeId: charge.id });
      return;
    }

    const credits = Number(payment.metadata.credits) || PRICE_CATALOG[payment.metadata.planId]?.credits || 0;
    const refunds = await this.client.refunds.list({ charge: charge.id, limit: 100 });
    let revoked = 0;
    for (const refund of refunds.data) {
      if (!['succeeded', 'pending'].includes(refund.status)) {
        continue;
      }
      const isFull = refund.amount >= charge.amount;
      revoked += await this.aiUsageService.revokeGrant({
        sourceId: payment.metadata.grantSourceId,
        credits: isFull ? null : Math.ceil((credits * refund.amount) / charge.amount),
        reason: `refund:${refund.id}`,
      });
    }
    await this.recordEvent(event, charge.id, payment.userId, 'refunded', {
      grantSourceId: payment.metadata.grantSourceId,
      revokedCredits: revoked,
    });
  }

  async handleDisputeCreated(event) {
    const dispute = event.data.object;
    const payment = await this.aiUsageService.findPaymentByPaymentIntent(idOf(dispute.payment_intent));
    if (!payment) {
      this.logger.warn('stripe_dispute_unmatched', { disputeId: dispute.id });
      return;
    }
    const revoked = await this.aiUsageService.revokeGrant({
      sourceId: payment.metadata.grantSourceId,
      credits: null,
      reason: `dispute:${dispute.id}`,
    });
    await this.recordEvent(event, dispute.id, payment.userId, 'disputed', {
      grantSourceId: payment.metadata.grantSourceId,
      revokedCredits: revoked,
    });
    this.logger.warn('stripe_dispute_created', { disputeId: dispute.id, revokedCredits: revoked });
  }

  // Replays Stripe's event log (30 days max). Safe because every handler is idempotent.
  async reconcileRecentEvents({ sinceDays = 7 } = {}) {
    if (!this.client) {
      throw new Error('Stripe is not configured.');
    }
    const created = { gte: Math.floor(Date.now() / 1000) - sinceDays * 86400 };
    const summary = { processed: 0, failed: 0, byType: {} };
    for await (const event of this.client.events.list({ types: HANDLED_EVENT_TYPES, created, limit: 100 })) {
      try {
        await this.handleWebhookEvent(event);
        summary.processed += 1;
        summary.byType[event.type] = (summary.byType[event.type] || 0) + 1;
      } catch (error) {
        summary.failed += 1;
        this.logger.error('stripe_reconcile_event_failed', { eventId: event.id, type: event.type, message: error.message });
      }
    }
    return summary;
  }
}

module.exports = {
  StripeBillingService,
  PRICE_CATALOG,
  HANDLED_EVENT_TYPES,
  getInvoiceSubscriptionId,
  getSubscriptionPeriod,
};
