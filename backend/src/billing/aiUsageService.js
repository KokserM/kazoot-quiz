const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { UserFacingError } = require('../errors');

// Credit lifecycle for one AI generation:
//   reserve  -> a free monthly game is counted, or paid credits are removed from grants
//   complete -> the reservation becomes a successful (charged) generation
//   release  -> the free game or paid credits are given back (failure, timeout, crash)
// With Supabase configured every step is a single Postgres function call
// (db/003_launch_hardening.sql), so it is atomic across processes and replays.
// Without Supabase an in-memory implementation with the same rules is used
// (local development and tests only).

const STALE_RESERVATION_SECONDS = 10 * 60;

function startOfTodayIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function startOfHourIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours())).toISOString();
}

function startOfMonthIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function startOfNextMonthIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

function isGrantAvailable(grant, nowIso = new Date().toISOString()) {
  return grant.remainingCredits > 0 && (!grant.expiresAt || grant.expiresAt > nowIso);
}

function estimateOpenAiCost({ inputTokens = 0, outputTokens = 0, config }) {
  return (
    (inputTokens / 1_000_000) * config.openAiEstInputCostPer1M +
    (outputTokens / 1_000_000) * config.openAiEstOutputCostPer1M
  );
}

function compareGrantSpendOrder(a, b) {
  const aExpiry = a.expiresAt || '9999-12-31T23:59:59.999Z';
  const bExpiry = b.expiresAt || '9999-12-31T23:59:59.999Z';
  return aExpiry.localeCompare(bExpiry) || String(a.createdAt).localeCompare(String(b.createdAt));
}

function mapGrantRow(grant) {
  return {
    id: grant.id,
    userId: grant.user_id,
    sourceId: grant.source_id,
    grantType: grant.grant_type,
    originalCredits: grant.original_credits,
    remainingCredits: grant.remaining_credits,
    expiresAt: grant.expires_at,
    metadata: grant.metadata || {},
    createdAt: grant.created_at,
  };
}

class AiUsageService {
  constructor({ config, client = undefined }) {
    this.config = config;
    this.client =
      client !== undefined
        ? client
        : config.supabaseUrl && config.supabaseServiceRoleKey
          ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
              auth: { autoRefreshToken: false, persistSession: false },
            })
          : null;
    this.memory = {
      ledger: [],
      creditGrants: [],
      generations: [],
      payments: new Map(),
      subscriptions: new Map(),
      profiles: new Map(),
      events: [],
    };
    this.memoryLocks = new Map();
  }

  isConfigured() {
    return Boolean(this.client);
  }

  getOperationId() {
    return crypto.randomUUID();
  }

  // ---------------------------------------------------------------- reading

  async getCreditGrants(userId) {
    if (!userId) {
      return [];
    }

    if (!this.client) {
      return this.memory.creditGrants.filter((grant) => grant.userId === userId).sort(compareGrantSpendOrder);
    }

    const { data, error } = await this.client
      .from('credit_grants')
      .select('id, user_id, source_id, grant_type, original_credits, remaining_credits, expires_at, metadata, created_at')
      .eq('user_id', userId)
      .order('expires_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to read AI game grants: ${error.message}`);
    }

    return (data || []).map(mapGrantRow);
  }

  async getCreditBalance(userId) {
    const grants = await this.getCreditGrants(userId);
    return grants.filter((grant) => isGrantAvailable(grant)).reduce((total, grant) => total + grant.remainingCredits, 0);
  }

  async countFreeQuotaUsedSince(userId, sinceIso) {
    if (!this.client) {
      return this.memory.generations.filter(
        (generation) =>
          generation.userId === userId &&
          generation.source === 'openai' &&
          ['reserved', 'succeeded'].includes(generation.status) &&
          (generation.chargeMode || 'free_quota') === 'free_quota' &&
          generation.createdAt >= sinceIso
      ).length;
    }

    const { data, error } = await this.client
      .from('quiz_generations')
      .select('charge_mode')
      .eq('user_id', userId)
      .eq('source', 'openai')
      .in('status', ['reserved', 'succeeded'])
      .gte('created_at', sinceIso);

    if (error) {
      throw new Error(`Failed to read usage count: ${error.message}`);
    }

    return (data || []).filter((row) => (row.charge_mode || 'free_quota') === 'free_quota').length;
  }

  async countGenerationsSince({ userId = null, ipAddress = null, sinceIso }) {
    if (!this.client) {
      return this.memory.generations.filter(
        (generation) =>
          (!userId || generation.userId === userId) &&
          (!ipAddress || generation.ipAddress === ipAddress) &&
          ['reserved', 'succeeded'].includes(generation.status) &&
          generation.createdAt >= sinceIso
      ).length;
    }

    let query = this.client
      .from('quiz_generations')
      .select('id', { count: 'exact', head: true })
      .in('status', ['reserved', 'succeeded'])
      .gte('created_at', sinceIso);
    if (userId) query = query.eq('user_id', userId);
    if (ipAddress) query = query.eq('ip_address', ipAddress);

    const { count, error } = await query;
    if (error) {
      throw new Error(`Failed to read generation count: ${error.message}`);
    }

    return count || 0;
  }

  async getSubscription(userId) {
    if (!userId) {
      return null;
    }

    if (!this.client) {
      return this.memory.subscriptions.get(userId) || null;
    }

    const { data, error } = await this.client
      .from('subscriptions')
      .select('tier, status, current_period_end, plan_id, cancel_at_period_end, stripe_customer_id, stripe_subscription_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to read subscription: ${error.message}`);
    }

    return data
      ? {
          tier: data.tier,
          status: data.status,
          currentPeriodEnd: data.current_period_end,
          planId: data.plan_id || null,
          cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
          stripeCustomerId: data.stripe_customer_id,
          stripeSubscriptionId: data.stripe_subscription_id,
        }
      : null;
  }

  async getRecentGenerations(userId) {
    if (!this.client) {
      return this.memory.generations
        .filter((generation) => generation.userId === userId)
        .slice(-10)
        .reverse()
        .map((generation) => ({
          id: generation.id,
          topic: generation.topic,
          status: generation.status,
          charge_mode: generation.chargeMode,
          created_at: generation.createdAt,
        }));
    }

    const { data, error } = await this.client
      .from('quiz_generations')
      .select('id, topic, status, charge_mode, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Failed to read generation history: ${error.message}`);
    }

    return data || [];
  }

  async getUsageSummary(userId) {
    const [freeUsedThisMonth, grants, subscription, recentGenerations] = await Promise.all([
      this.countFreeQuotaUsedSince(userId, startOfMonthIso()),
      this.getCreditGrants(userId),
      this.getSubscription(userId),
      this.getRecentGenerations(userId),
    ]);

    const nowIso = new Date().toISOString();
    const activeGrants = grants.filter((grant) => isGrantAvailable(grant, nowIso));
    const credits = activeGrants.reduce((total, grant) => total + grant.remainingCredits, 0);
    const freeRemainingThisMonth = Math.max(0, this.config.freeAiGamesPerMonth - freeUsedThisMonth);

    return {
      freeLimitMonthly: this.config.freeAiGamesPerMonth,
      freeUsedThisMonth,
      freeRemainingThisMonth,
      freeResetsAt: startOfNextMonthIso(),
      credits,
      aiGamesLeft: freeRemainingThisMonth + credits,
      // Soonest-expiring first: the order credits are spent in.
      grants: activeGrants.map((grant) => ({
        id: grant.id,
        type: grant.grantType,
        planId: grant.metadata?.planId || null,
        originalCredits: grant.originalCredits,
        remainingCredits: grant.remainingCredits,
        expiresAt: grant.expiresAt,
        createdAt: grant.createdAt,
      })),
      tier: subscription && ['active', 'trialing', 'past_due'].includes(subscription.status) ? subscription.tier : 'free',
      subscription: subscription
        ? {
            tier: subscription.tier,
            planId: subscription.planId,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
      recentGenerations,
    };
  }

  // ------------------------------------------------------------- reserving

  async enforceRateLimits({ userId, ipAddress }) {
    const sinceIso = startOfHourIso();
    const userCount = await this.countGenerationsSince({ userId, sinceIso });
    if (userCount >= this.config.maxAiGenerationsPerUserPerHour) {
      throw new UserFacingError('You have created a lot of quizzes in the last hour. Please try again a little later.', {
        code: 'rate_limited',
        status: 429,
      });
    }

    if (ipAddress && this.config.maxAiGenerationsPerIpPerHour) {
      const ipCount = await this.countGenerationsSince({ ipAddress, sinceIso });
      if (ipCount >= this.config.maxAiGenerationsPerIpPerHour) {
        throw new UserFacingError('Too many quizzes were created from this network in the last hour. Please try again later.', {
          code: 'rate_limited',
          status: 429,
        });
      }
    }
  }

  async getEstimatedSpendSince(sinceIso) {
    if (!this.client) {
      return this.memory.generations
        .filter((generation) => generation.createdAt >= sinceIso)
        .reduce((total, generation) => total + (generation.estimatedCostUsd || 0), 0);
    }

    // Failed attempts still cost tokens, so every status is counted.
    const { data, error } = await this.client
      .from('quiz_generations')
      .select('estimated_cost_usd')
      .gte('created_at', sinceIso);

    if (error) {
      throw new Error(`Failed to read AI spend: ${error.message}`);
    }

    return (data || []).reduce((total, generation) => total + Number(generation.estimated_cost_usd || 0), 0);
  }

  async enforceBudgetCaps() {
    const todaySpend = await this.getEstimatedSpendSince(startOfTodayIso());
    if (todaySpend >= this.config.dailyOpenAiBudgetUsd) {
      throw new UserFacingError('Kazoot has reached its AI safety limit for today. Your credits are untouched — please try again tomorrow, or play a demo quiz.', {
        code: 'budget_reached',
        status: 503,
      });
    }

    const monthSpend = await this.getEstimatedSpendSince(startOfMonthIso());
    if (monthSpend >= this.config.monthlyOpenAiBudgetUsd) {
      throw new UserFacingError('Kazoot has reached its AI safety limit for this month. Your credits are untouched — please contact support.', {
        code: 'budget_reached',
        status: 503,
      });
    }
  }

  async reserveQuizGeneration({ user, topic, language, model, ipAddress }) {
    if (!user?.id) {
      throw new UserFacingError('Sign in to create a quiz on your own topic. The demo is free without an account.', {
        code: 'auth_required',
        status: 401,
      });
    }

    await this.enforceRateLimits({ userId: user.id, ipAddress });
    await this.enforceBudgetCaps();

    const generationId = this.getOperationId();
    const creditCost = this.config.aiCreditCostPerQuiz;

    if (!this.client) {
      return this.withMemoryLock(user.id, () =>
        this.reserveInMemory({ generationId, userId: user.id, topic, language, model, ipAddress, creditCost })
      );
    }

    const { data, error } = await this.client.rpc('kz_reserve_generation', {
      p_generation_id: generationId,
      p_user_id: user.id,
      p_topic: topic,
      p_language: language,
      p_model: model,
      p_ip: ipAddress || null,
      p_free_limit: this.config.freeAiGamesPerMonth,
      p_cost: creditCost,
      p_period_start: startOfMonthIso(),
    });

    if (error) {
      if (/insufficient_credits/.test(error.message)) {
        throw new UserFacingError('You have no AI games left. Buy a pack or wait for next month’s free games.', {
          code: 'insufficient_credits',
          status: 402,
        });
      }
      throw new Error(`Failed to reserve AI game: ${error.message}`);
    }

    return {
      generationId,
      userId: user.id,
      mode: data.mode,
      creditCost: data.creditCost,
    };
  }

  async completeQuizGeneration(reservation, { usage = {} } = {}) {
    if (!reservation?.generationId) {
      return false;
    }

    const inputTokens = usage.inputTokens || 0;
    const outputTokens = usage.outputTokens || 0;
    const estimatedCostUsd = estimateOpenAiCost({ inputTokens, outputTokens, config: this.config });

    if (!this.client) {
      const generation = this.memory.generations.find((item) => item.id === reservation.generationId);
      if (!generation || generation.status !== 'reserved') {
        return false;
      }
      Object.assign(generation, { status: 'succeeded', inputTokens, outputTokens, estimatedCostUsd });
      return true;
    }

    const { data, error } = await this.client.rpc('kz_complete_generation', {
      p_generation_id: reservation.generationId,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_estimated_cost_usd: estimatedCostUsd,
    });
    if (error) {
      throw new Error(`Failed to complete AI game: ${error.message}`);
    }
    return Boolean(data);
  }

  // Safe to call more than once; only the first call gives credits back.
  async releaseQuizGeneration(reservation, error, { usage = {} } = {}) {
    if (!reservation?.generationId) {
      return false;
    }

    const message = String(error?.message || 'Generation failed').slice(0, 500);
    const inputTokens = usage.inputTokens || 0;
    const outputTokens = usage.outputTokens || 0;
    const estimatedCostUsd = estimateOpenAiCost({ inputTokens, outputTokens, config: this.config });

    if (!this.client) {
      return this.releaseInMemory(reservation.generationId, message, { inputTokens, outputTokens, estimatedCostUsd });
    }

    const { data, error: rpcError } = await this.client.rpc('kz_release_generation', {
      p_generation_id: reservation.generationId,
      p_error: message,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_estimated_cost_usd: estimatedCostUsd,
    });
    if (rpcError) {
      throw new Error(`Failed to release AI game: ${rpcError.message}`);
    }
    return Boolean(data);
  }

  async releaseStaleReservations(olderThanSeconds = STALE_RESERVATION_SECONDS) {
    if (!this.client) {
      const cutoff = new Date(Date.now() - olderThanSeconds * 1000).toISOString();
      const stale = this.memory.generations.filter((g) => g.status === 'reserved' && g.createdAt < cutoff);
      stale.forEach((generation) => this.releaseInMemory(generation.id, 'Reservation expired before completion'));
      return stale.length;
    }

    const { data, error } = await this.client.rpc('kz_release_stale_generations', {
      p_older_than_seconds: olderThanSeconds,
    });
    if (error) {
      throw new Error(`Failed to release stale reservations: ${error.message}`);
    }
    return data || 0;
  }

  async applyRetention() {
    if (!this.client) {
      const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
      this.memory.generations.forEach((generation) => {
        if (generation.createdAt < cutoff) generation.ipAddress = null;
      });
      return {};
    }
    const { data, error } = await this.client.rpc('kz_apply_retention', {});
    if (error) {
      throw new Error(`Failed to apply retention: ${error.message}`);
    }
    return data;
  }

  // --------------------------------------------------------------- granting

  async grantCredits({ userId, credits, reason, sourceId, metadata = {}, grantType = 'manual', expiresAt = null }) {
    if (!this.client) {
      const existing = this.memory.creditGrants.find(
        (grant) => grant.userId === userId && grant.sourceId === sourceId && grant.grantType === grantType
      );
      if (existing) {
        return false;
      }
      this.memory.creditGrants.push({
        id: this.getOperationId(),
        userId,
        sourceId,
        grantType,
        originalCredits: credits,
        remainingCredits: credits,
        expiresAt,
        metadata: { ...metadata, reason },
        createdAt: new Date().toISOString(),
      });
      this.memory.ledger.push({ userId, delta: credits, reason, sourceId, metadata });
      return true;
    }

    const { data, error } = await this.client.rpc('kz_grant_credits', {
      p_user_id: userId,
      p_source_id: sourceId,
      p_grant_type: grantType,
      p_credits: credits,
      p_expires_at: expiresAt,
      p_reason: reason,
      p_metadata: metadata,
    });
    if (error) {
      throw new Error(`Failed to grant AI games: ${error.message}`);
    }
    return Boolean(data);
  }

  // Removes unused credits from the grant created by `sourceId`. `credits` null = all remaining.
  async revokeGrant({ sourceId, credits = null, reason }) {
    if (!this.client) {
      this.memory.revocations = this.memory.revocations || new Set();
      const key = `${sourceId}:${reason}`;
      if (this.memory.revocations.has(key)) {
        return 0;
      }
      this.memory.revocations.add(key);
      let revoked = 0;
      this.memory.creditGrants
        .filter((grant) => grant.sourceId === sourceId)
        .forEach((grant) => {
          const take = credits === null ? grant.remainingCredits : Math.min(grant.remainingCredits, Math.max(credits - revoked, 0));
          grant.remainingCredits -= take;
          revoked += take;
        });
      return revoked;
    }

    const { data, error } = await this.client.rpc('kz_revoke_grant', {
      p_source_id: sourceId,
      p_credits: credits,
      p_reason: reason,
    });
    if (error) {
      throw new Error(`Failed to revoke AI games: ${error.message}`);
    }
    return data || 0;
  }

  // ---------------------------------------------------------------- payments

  // Audit log of Stripe events. Returns false for a replayed event id.
  async recordPayment({ stripeEventId, stripeObjectId, userId, amountTotal, currency, status, metadata = {} }) {
    if (!this.client) {
      if (this.memory.payments.has(stripeEventId)) {
        return false;
      }
      this.memory.payments.set(stripeEventId, { stripeObjectId, userId, amountTotal, currency, status, metadata });
      return true;
    }

    const { error } = await this.client.from('payments').insert({
      stripe_event_id: stripeEventId,
      stripe_object_id: stripeObjectId,
      user_id: userId,
      amount_total: amountTotal,
      currency,
      status,
      metadata,
    });

    if (error?.code === '23505') {
      return false;
    }
    if (error) {
      throw new Error(`Failed to record payment: ${error.message}`);
    }
    return true;
  }

  async findPaymentByPaymentIntent(paymentIntentId) {
    if (!paymentIntentId) {
      return null;
    }

    if (!this.client) {
      for (const payment of this.memory.payments.values()) {
        if (payment.metadata?.paymentIntentId === paymentIntentId && payment.metadata?.grantSourceId) {
          return payment;
        }
      }
      return null;
    }

    const { data, error } = await this.client
      .from('payments')
      .select('stripe_object_id, user_id, amount_total, currency, status, metadata')
      .eq('metadata->>paymentIntentId', paymentIntentId)
      .not('metadata->>grantSourceId', 'is', null)
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to look up payment: ${error.message}`);
    }
    return data
      ? {
          stripeObjectId: data.stripe_object_id,
          userId: data.user_id,
          amountTotal: data.amount_total,
          currency: data.currency,
          status: data.status,
          metadata: data.metadata || {},
        }
      : null;
  }

  async upsertSubscription({ userId, stripeCustomerId, stripeSubscriptionId, tier, planId, status, currentPeriodEnd, cancelAtPeriodEnd }) {
    if (!userId) {
      return;
    }

    if (!this.client) {
      this.memory.subscriptions.set(userId, {
        tier,
        planId,
        status,
        currentPeriodEnd,
        cancelAtPeriodEnd: Boolean(cancelAtPeriodEnd),
        stripeCustomerId,
        stripeSubscriptionId,
      });
      return;
    }

    const { error } = await this.client.from('subscriptions').upsert(
      {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        tier,
        plan_id: planId,
        status,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: Boolean(cancelAtPeriodEnd),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      throw new Error(`Failed to update subscription: ${error.message}`);
    }
  }

  async getStripeCustomerId(userId) {
    if (!this.client) {
      return this.memory.profiles.get(userId)?.stripeCustomerId || null;
    }

    const { data, error } = await this.client.from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle();
    if (error) {
      throw new Error(`Failed to read profile: ${error.message}`);
    }
    return data?.stripe_customer_id || null;
  }

  async setStripeCustomerId(userId, stripeCustomerId) {
    if (!this.client) {
      this.memory.profiles.set(userId, { ...(this.memory.profiles.get(userId) || {}), stripeCustomerId });
      return;
    }

    const { error } = await this.client.from('profiles').update({ stripe_customer_id: stripeCustomerId }).eq('id', userId);
    if (error) {
      throw new Error(`Failed to save Stripe customer: ${error.message}`);
    }
  }

  async findUserIdByStripeCustomer(stripeCustomerId) {
    if (!stripeCustomerId) {
      return null;
    }

    if (!this.client) {
      for (const [userId, profile] of this.memory.profiles.entries()) {
        if (profile.stripeCustomerId === stripeCustomerId) {
          return userId;
        }
      }
      return null;
    }

    const { data, error } = await this.client.from('profiles').select('id').eq('stripe_customer_id', stripeCustomerId).maybeSingle();
    if (error) {
      throw new Error(`Failed to look up Stripe customer: ${error.message}`);
    }
    return data?.id || null;
  }

  // ------------------------------------------------------------- analytics

  async recordProductEvent(name, props = {}) {
    if (!this.client) {
      this.memory.events.push({ name, props, createdAt: new Date().toISOString() });
      if (this.memory.events.length > 5000) {
        this.memory.events.splice(0, this.memory.events.length - 5000);
      }
      return;
    }

    const { error } = await this.client.from('product_events').insert({ name, props });
    if (error) {
      throw new Error(`Failed to record product event: ${error.message}`);
    }
  }

  // ------------------------------------------------------- in-memory backend

  async withMemoryLock(key, operation) {
    const previous = this.memoryLocks.get(key) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => current);
    this.memoryLocks.set(key, chained);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.memoryLocks.get(key) === chained) {
        this.memoryLocks.delete(key);
      }
    }
  }

  async reserveInMemory({ generationId, userId, topic, language, model, ipAddress, creditCost }) {
    const freeUsed = await this.countFreeQuotaUsedSince(userId, startOfMonthIso());
    const mode = freeUsed < this.config.freeAiGamesPerMonth ? 'free_quota' : 'paid_credit';
    const consumedGrants = [];

    if (mode === 'paid_credit') {
      const grants = this.memory.creditGrants
        .filter((grant) => grant.userId === userId && isGrantAvailable(grant))
        .sort(compareGrantSpendOrder);
      const available = grants.reduce((total, grant) => total + grant.remainingCredits, 0);
      if (available < creditCost) {
        throw new UserFacingError('You have no AI games left. Buy a pack or wait for next month’s free games.', {
          code: 'insufficient_credits',
          status: 402,
        });
      }
      let remaining = creditCost;
      for (const grant of grants) {
        if (remaining <= 0) break;
        const take = Math.min(grant.remainingCredits, remaining);
        grant.remainingCredits -= take;
        consumedGrants.push({ grantId: grant.id, amount: take });
        remaining -= take;
      }
      this.memory.ledger.push({ userId, delta: -creditCost, reason: 'ai_quiz_reserved', sourceId: generationId });
    }

    this.memory.generations.push({
      id: generationId,
      userId,
      ipAddress,
      topic,
      language,
      model,
      source: 'openai',
      status: 'reserved',
      chargeMode: mode,
      consumedGrants,
      createdAt: new Date().toISOString(),
    });

    return { generationId, userId, mode, creditCost: mode === 'paid_credit' ? creditCost : 0 };
  }

  releaseInMemory(generationId, message, usage = {}) {
    const generation = this.memory.generations.find((item) => item.id === generationId);
    if (!generation || generation.status !== 'reserved') {
      return false;
    }

    generation.status = generation.chargeMode === 'paid_credit' ? 'refunded' : 'failed';
    generation.error = message;
    generation.estimatedCostUsd = usage.estimatedCostUsd || 0;
    if (generation.chargeMode === 'paid_credit') {
      let restored = 0;
      generation.consumedGrants.forEach(({ grantId, amount }) => {
        const grant = this.memory.creditGrants.find((item) => item.id === grantId);
        if (grant) {
          grant.remainingCredits += amount;
          restored += amount;
        }
      });
      this.memory.ledger.push({ userId: generation.userId, delta: restored, reason: 'ai_quiz_refunded', sourceId: generationId });
    }
    return true;
  }
}

module.exports = {
  AiUsageService,
  UserFacingError,
  estimateOpenAiCost,
  startOfMonthIso,
  STALE_RESERVATION_SECONDS,
};
