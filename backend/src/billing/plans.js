// Every plan Kazoot has ever sold stays in this catalog so webhooks for existing
// customers keep working. Which plans are offered to new buyers is controlled with
// BILLING_VISIBLE_PLANS (comma-separated ids) without a code change.
//
// Amounts here are display copies only. Stripe Checkout charges the amount on the
// Stripe price, so keep them in sync with the Stripe dashboard.
const PRICE_CATALOG = {
  credits_20: {
    envKey: 'stripeCreditPack20PriceId',
    mode: 'payment',
    tier: 'credit_pack',
    name: 'Pack 20',
    credits: 20,
    amountCents: 500,
    currency: 'EUR',
    interval: null,
    validityMonths: 12,
  },
  credits_60: {
    envKey: 'stripeCreditPack60PriceId',
    mode: 'payment',
    tier: 'credit_pack',
    name: 'Pack 60',
    credits: 60,
    amountCents: 1200,
    currency: 'EUR',
    interval: null,
    validityMonths: 12,
  },
  credits_150: {
    envKey: 'stripeCreditPack150PriceId',
    mode: 'payment',
    tier: 'credit_pack',
    name: 'Pack 150',
    credits: 150,
    amountCents: 2500,
    currency: 'EUR',
    interval: null,
    validityMonths: 12,
  },
  plus_monthly: {
    envKey: 'stripePlusPriceId',
    mode: 'subscription',
    tier: 'plus',
    name: 'Plus',
    credits: 30,
    amountCents: 500,
    currency: 'EUR',
    interval: 'month',
    // Unused games stay usable for one more billing period after the one they were granted for.
    rolloverPeriods: 1,
  },
  pro_monthly: {
    envKey: 'stripeProPriceId',
    mode: 'subscription',
    tier: 'pro',
    name: 'Pro',
    credits: 90,
    amountCents: 1200,
    currency: 'EUR',
    interval: 'month',
    rolloverPeriods: 1,
  },
};

const DEFAULT_VISIBLE_PLANS = Object.keys(PRICE_CATALOG);

function getVisiblePlanIds(config) {
  const configured = String(config.billingVisiblePlans || '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => PRICE_CATALOG[id]);
  return configured.length ? configured : DEFAULT_VISIBLE_PLANS;
}

function findPlanByPriceId(config, priceId) {
  if (!priceId) {
    return null;
  }
  const entry = Object.entries(PRICE_CATALOG).find(([, plan]) => config[plan.envKey] && config[plan.envKey] === priceId);
  return entry ? { id: entry[0], ...entry[1] } : null;
}

module.exports = {
  PRICE_CATALOG,
  getVisiblePlanIds,
  findPlanByPriceId,
};
