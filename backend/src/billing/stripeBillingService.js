const Stripe = require('stripe');

const PRICE_CATALOG = {
  plus_monthly: {
    envKey: 'stripePlusPriceId',
    mode: 'subscription',
    tier: 'plus',
    credits: 100,
  },
  pro_monthly: {
    envKey: 'stripeProPriceId',
    mode: 'subscription',
    tier: 'pro',
    credits: 350,
  },
  credits_100: {
    envKey: 'stripeCreditPack100PriceId',
    mode: 'payment',
    tier: 'credit_pack',
    credits: 100,
  },
  credits_250: {
    envKey: 'stripeCreditPack250PriceId',
    mode: 'payment',
    tier: 'credit_pack',
    credits: 250,
  },
};

class StripeBillingService {
  constructor({ config, aiUsageService }) {
    this.config = config;
    this.aiUsageService = aiUsageService;
    this.client = config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;
  }

  isConfigured() {
    return Boolean(this.client);
  }

  getCatalog() {
    return Object.entries(PRICE_CATALOG).map(([id, item]) => ({
      id,
      mode: item.mode,
      tier: item.tier,
      credits: item.credits,
      configured: Boolean(this.config[item.envKey]),
    }));
  }

  async createCheckoutSession({ user, planId }) {
    if (!this.client) {
      throw new Error('Billing is not configured yet.');
    }

    const plan = PRICE_CATALOG[planId];
    if (!plan) {
      throw new Error('Unknown billing plan.');
    }

    const priceId = this.config[plan.envKey];
    if (!priceId) {
      throw new Error('This billing plan is not configured.');
    }

    const session = await this.client.checkout.sessions.create({
      mode: plan.mode,
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: this.config.billingSuccessUrl,
      cancel_url: this.config.billingCancelUrl,
      metadata: {
        userId: user.id,
        planId,
        credits: String(plan.credits),
        tier: plan.tier,
      },
      subscription_data:
        plan.mode === 'subscription'
          ? {
              metadata: {
                userId: user.id,
                planId,
                credits: String(plan.credits),
                tier: plan.tier,
              },
            }
          : undefined,
    });

    return {
      url: session.url,
    };
  }

  constructWebhookEvent(rawBody, signature) {
    if (!this.client || !this.config.stripeWebhookSecret) {
      throw new Error('Stripe webhook is not configured.');
    }

    return this.client.webhooks.constructEvent(rawBody, signature, this.config.stripeWebhookSecret);
  }

  async handleWebhookEvent(event) {
    if (event.type === 'checkout.session.completed') {
      await this.handleCheckoutCompleted(event);
    }

    if (event.type === 'invoice.paid') {
      await this.handleInvoicePaid(event);
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      await this.handleSubscriptionChanged(event);
    }
  }

  getConfiguredPriceId(plan) {
    return plan ? this.config[plan.envKey] : '';
  }

  async checkoutSessionUsesConfiguredPrice(session, plan) {
    const expectedPriceId = this.getConfiguredPriceId(plan);
    if (!expectedPriceId || !this.client) {
      return false;
    }

    const lineItems = await this.client.checkout.sessions.listLineItems(session.id, { limit: 10 });
    return lineItems.data.some((item) => item.price?.id === expectedPriceId);
  }

  subscriptionUsesConfiguredPrice(subscription, plan) {
    const expectedPriceId = this.getConfiguredPriceId(plan);
    if (!expectedPriceId) {
      return false;
    }

    return subscription.items?.data?.some((item) => item.price?.id === expectedPriceId) || false;
  }

  async handleCheckoutCompleted(event) {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;
    const plan = PRICE_CATALOG[planId];
    if (!userId || !plan) {
      return;
    }

    const usesConfiguredPrice = await this.checkoutSessionUsesConfiguredPrice(session, plan);
    if (!usesConfiguredPrice) {
      return;
    }

    const inserted = await this.aiUsageService.recordPayment({
      stripeEventId: event.id,
      stripeObjectId: session.id,
      userId,
      amountTotal: session.amount_total,
      currency: session.currency,
      status: session.payment_status || 'completed',
      metadata: session.metadata || {},
    });

    if (!inserted) {
      return;
    }

    if (plan.mode === 'payment') {
      await this.aiUsageService.grantCredits({
        userId,
        credits: plan.credits,
        reason: 'stripe_credit_pack',
        sourceId: session.id,
        metadata: { planId },
      });
    }
  }

  async handleInvoicePaid(event) {
    const invoice = event.data.object;
    const subscriptionId =
      typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
    if (!subscriptionId || !this.client) {
      return;
    }

    const subscription = await this.client.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata?.userId;
    const planId = subscription.metadata?.planId;
    const plan = PRICE_CATALOG[planId];
    if (!userId || !plan) {
      return;
    }

    if (!this.subscriptionUsesConfiguredPrice(subscription, plan)) {
      return;
    }

    const inserted = await this.aiUsageService.recordPayment({
      stripeEventId: event.id,
      stripeObjectId: invoice.id,
      userId,
      amountTotal: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status || 'paid',
      metadata: { planId, subscriptionId },
    });

    if (!inserted) {
      return;
    }

    await this.aiUsageService.grantCredits({
      userId,
      credits: plan.credits,
      reason: 'stripe_subscription_credits',
      sourceId: invoice.id,
      metadata: { planId, subscriptionId },
    });

    await this.aiUsageService.upsertSubscription({
      userId,
      stripeCustomerId: subscription.customer,
      stripeSubscriptionId: subscription.id,
      tier: plan.tier,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    });
  }

  async handleSubscriptionChanged(event) {
    const subscription = event.data.object;
    const userId = subscription.metadata?.userId;
    const planId = subscription.metadata?.planId;
    const plan = PRICE_CATALOG[planId] || { tier: 'free' };
    if (!userId) {
      return;
    }

    if (event.type !== 'customer.subscription.deleted' && !this.subscriptionUsesConfiguredPrice(subscription, plan)) {
      return;
    }

    await this.aiUsageService.upsertSubscription({
      userId,
      stripeCustomerId: subscription.customer,
      stripeSubscriptionId: subscription.id,
      tier: event.type === 'customer.subscription.deleted' ? 'free' : plan.tier,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    });
  }
}

module.exports = {
  StripeBillingService,
  PRICE_CATALOG,
};
