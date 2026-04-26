const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

function startOfTodayIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function startOfHourIso(now = new Date()) {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours()
  )).toISOString();
}

function startOfMonthIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function addMonthsIso(dateInput, months) {
  const date = dateInput ? new Date(dateInput) : new Date();
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString();
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

class AiUsageService {
  constructor({ config }) {
    this.config = config;
    this.client =
      config.supabaseUrl && config.supabaseServiceRoleKey
        ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          })
        : null;
    this.memory = {
      ledger: [],
      creditGrants: [],
      generations: [],
      payments: new Set(),
      subscriptions: new Map(),
    };
    this.userLocks = new Map();
  }

  isConfigured() {
    return Boolean(this.client);
  }

  getOperationId() {
    return crypto.randomUUID();
  }

  async getCreditBalance(userId) {
    if (!userId) {
      return 0;
    }

    const grants = await this.getCreditGrants(userId);
    if (grants.length > 0) {
      return grants
        .filter((grant) => isGrantAvailable(grant))
        .reduce((total, grant) => total + grant.remainingCredits, 0);
    }

    return this.getLegacyCreditBalance(userId);
  }

  async getLegacyCreditBalance(userId) {
    if (!this.client) {
      return this.memory.ledger
        .filter((entry) => entry.userId === userId)
        .reduce((total, entry) => total + entry.delta, 0);
    }

    const { data, error } = await this.client
      .from('usage_ledger')
      .select('delta')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to read credit balance: ${error.message}`);
    }

    return data.reduce((total, entry) => total + entry.delta, 0);
  }

  async countSuccessfulGenerationsSince(userId, sinceIso) {
    if (!userId) {
      return 0;
    }

    if (!this.client) {
      return this.memory.generations.filter(
        (generation) =>
          generation.userId === userId &&
          generation.status === 'succeeded' &&
          generation.source === 'openai' &&
          generation.createdAt >= sinceIso
      ).length;
    }

    const { count, error } = await this.client
      .from('quiz_generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'succeeded')
      .eq('source', 'openai')
      .gte('created_at', sinceIso);

    if (error) {
      throw new Error(`Failed to read usage count: ${error.message}`);
    }

    return count || 0;
  }

  async countReservedOrSuccessfulGenerationsSince(userId, sinceIso) {
    if (!userId) {
      return 0;
    }

    if (!this.client) {
      return this.memory.generations.filter(
        (generation) =>
          generation.userId === userId &&
          ['reserved', 'succeeded'].includes(generation.status) &&
          generation.source === 'openai' &&
          generation.createdAt >= sinceIso
      ).length;
    }

    const { count, error } = await this.client
      .from('quiz_generations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('source', 'openai')
      .in('status', ['reserved', 'succeeded'])
      .gte('created_at', sinceIso);

    if (error) {
      throw new Error(`Failed to read reserved usage count: ${error.message}`);
    }

    return count || 0;
  }

  async withUserLock(userId, operation) {
    const previous = this.userLocks.get(userId) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => current);
    this.userLocks.set(userId, chained);

    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.userLocks.get(userId) === chained) {
        this.userLocks.delete(userId);
      }
    }
  }

  async getUsageSummary(userId) {
    if (!userId) {
      return {
        freeLimit: this.config.freeAiGamesPerMonth,
        freeLimitMonthly: this.config.freeAiGamesPerMonth,
        freeUsedToday: 0,
        freeUsedThisMonth: 0,
        freeRemainingToday: 0,
        freeRemainingThisMonth: 0,
        credits: 0,
        aiGamesLeft: 0,
        tier: 'anonymous',
        subscriptionStatus: 'none',
        recentGenerations: [],
      };
    }

    const [freeUsedThisMonth, credits, subscription] = await Promise.all([
      this.countSuccessfulGenerationsSince(userId, startOfMonthIso()),
      this.getCreditBalance(userId),
      this.getSubscription(userId),
    ]);

    const recentGenerations = await this.getRecentGenerations(userId);
    const freeRemainingThisMonth = Math.max(0, this.config.freeAiGamesPerMonth - freeUsedThisMonth);

    return {
      freeLimit: this.config.freeAiGamesPerMonth,
      freeLimitMonthly: this.config.freeAiGamesPerMonth,
      freeUsedToday: freeUsedThisMonth,
      freeUsedThisMonth,
      freeRemainingToday: freeRemainingThisMonth,
      freeRemainingThisMonth,
      credits,
      aiGamesLeft: freeRemainingThisMonth + credits,
      tier: subscription?.tier || 'free',
      subscriptionStatus: subscription?.status || 'inactive',
      currentPeriodEnd: subscription?.currentPeriodEnd || null,
      recentGenerations,
    };
  }

  async getRecentGenerations(userId) {
    if (!userId) {
      return [];
    }

    if (!this.client) {
      return this.memory.generations
        .filter((generation) => generation.userId === userId)
        .slice(-10)
        .reverse();
    }

    const { data, error } = await this.client
      .from('quiz_generations')
      .select('id, topic, language, model, source, input_tokens, output_tokens, estimated_cost_usd, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw new Error(`Failed to read generation history: ${error.message}`);
    }

    return data || [];
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
      .select('tier, status, current_period_end')
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
        }
      : null;
  }

  async reserveQuizGeneration({ user, topic, language, model, ipAddress }) {
    if (!user?.id) {
      throw new Error('Sign in to generate AI questions. Demo games are free.');
    }

    return this.withUserLock(user.id, () =>
      this.reserveQuizGenerationUnlocked({ user, topic, language, model, ipAddress })
    );
  }

  async reserveQuizGenerationUnlocked({ user, topic, language, model, ipAddress }) {
    await this.enforceRateLimits({ userId: user.id, ipAddress });
    await this.enforceBudgetCaps();

    const freeUsedThisMonth = await this.countReservedOrSuccessfulGenerationsSince(user.id, startOfMonthIso());
    const credits = await this.getCreditBalance(user.id);
    const useFreeQuota = freeUsedThisMonth < this.config.freeAiGamesPerMonth;
    const creditCost = this.config.aiCreditCostPerQuiz;

    if (!useFreeQuota && credits < creditCost) {
      throw new Error('You are out of AI games. Upgrade or buy a pack to continue.');
    }

    const generationId = this.getOperationId();
    const reservation = {
      generationId,
      userId: user.id,
      mode: useFreeQuota ? 'free_quota' : 'paid_credit',
      creditCost,
    };

    await this.insertGeneration({
      id: generationId,
      userId: user.id,
      topic,
      language,
      model,
      ipAddress,
      source: 'openai',
      status: 'reserved',
    });

    if (!useFreeQuota) {
      const consumedGrants = await this.consumeCreditGrants({
        userId: user.id,
        credits: creditCost,
      });
      reservation.consumedGrants = consumedGrants;

      await this.insertLedger({
        userId: user.id,
        delta: -creditCost,
        reason: 'ai_quiz_reserved',
        sourceId: generationId,
        metadata: { topic, language, model, consumedGrants },
      });
    }

    return reservation;
  }

  async completeQuizGeneration(reservation, { quiz, usage = {} }) {
    if (!reservation?.generationId) {
      return;
    }

    const inputTokens = usage.inputTokens || 0;
    const outputTokens = usage.outputTokens || 0;
    const estimatedCostUsd =
      typeof usage.estimatedCostUsd === 'number'
        ? usage.estimatedCostUsd
        : estimateOpenAiCost({ inputTokens, outputTokens, config: this.config });

    await this.updateGeneration(reservation.generationId, {
      status: 'succeeded',
      source: quiz?.source || 'openai',
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      completedAt: new Date().toISOString(),
    });
  }

  async refundQuizGeneration(reservation, error) {
    if (!reservation?.generationId) {
      return;
    }

    await this.updateGeneration(reservation.generationId, {
      status: 'failed',
      error: error?.message || 'Generation failed',
      completedAt: new Date().toISOString(),
    });

    if (reservation.mode === 'paid_credit') {
      await this.restoreConsumedCreditGrants(reservation.consumedGrants || []);
      await this.insertLedger({
        userId: reservation.userId,
        delta: reservation.creditCost,
        reason: 'ai_quiz_refunded',
        sourceId: reservation.generationId,
        metadata: { reason: error?.message || 'Generation failed' },
      });
    }
  }

  async enforceRateLimits({ userId, ipAddress }) {
    const userCount = await this.countSuccessfulGenerationsSince(userId, startOfHourIso());
    if (userCount >= this.config.maxAiGenerationsPerUserPerHour) {
      throw new Error('You are generating AI quizzes too quickly. Try again later.');
    }

    if (!ipAddress || !this.config.maxAiGenerationsPerIpPerHour) {
      return;
    }

    const ipCount = await this.countSuccessfulGenerationsFromIpSince(ipAddress, startOfHourIso());
    if (ipCount >= this.config.maxAiGenerationsPerIpPerHour) {
      throw new Error('Too many AI quizzes from this network. Try again later.');
    }
  }

  async enforceBudgetCaps() {
    const todaySpend = await this.getEstimatedSpendSince(startOfTodayIso());
    if (todaySpend >= this.config.dailyOpenAiBudgetUsd) {
      throw new Error('Daily AI generation budget reached. Demo games are still available.');
    }

    const monthSpend = await this.getEstimatedSpendSince(startOfMonthIso());
    if (monthSpend >= this.config.monthlyOpenAiBudgetUsd) {
      throw new Error('Monthly AI generation budget reached. Demo games are still available.');
    }
  }

  async countSuccessfulGenerationsFromIpSince(ipAddress, sinceIso) {
    if (!ipAddress) {
      return 0;
    }

    if (!this.client) {
      return this.memory.generations.filter(
        (generation) =>
          generation.ipAddress === ipAddress &&
          generation.status === 'succeeded' &&
          generation.createdAt >= sinceIso
      ).length;
    }

    const { count, error } = await this.client
      .from('quiz_generations')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ipAddress)
      .eq('status', 'succeeded')
      .gte('created_at', sinceIso);

    if (error) {
      throw new Error(`Failed to read IP usage count: ${error.message}`);
    }

    return count || 0;
  }

  async getEstimatedSpendSince(sinceIso) {
    if (!this.client) {
      return this.memory.generations
        .filter((generation) => generation.status === 'succeeded' && generation.createdAt >= sinceIso)
        .reduce((total, generation) => total + (generation.estimatedCostUsd || 0), 0);
    }

    const { data, error } = await this.client
      .from('quiz_generations')
      .select('estimated_cost_usd')
      .eq('status', 'succeeded')
      .gte('created_at', sinceIso);

    if (error) {
      throw new Error(`Failed to read AI spend: ${error.message}`);
    }

    return data.reduce((total, generation) => total + Number(generation.estimated_cost_usd || 0), 0);
  }

  async insertGeneration(generation) {
    if (!this.client) {
      this.memory.generations.push({
        ...generation,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    const { error } = await this.client.from('quiz_generations').insert({
      id: generation.id,
      user_id: generation.userId,
      ip_address: generation.ipAddress || null,
      topic: generation.topic,
      language: generation.language,
      model: generation.model,
      source: generation.source,
      status: generation.status,
    });

    if (error) {
      throw new Error(`Failed to reserve generation: ${error.message}`);
    }
  }

  async updateGeneration(generationId, patch) {
    if (!this.client) {
      const generation = this.memory.generations.find((item) => item.id === generationId);
      if (generation) {
        Object.assign(generation, patch);
      }
      return;
    }

    const update = {};
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.source !== undefined) update.source = patch.source;
    if (patch.inputTokens !== undefined) update.input_tokens = patch.inputTokens;
    if (patch.outputTokens !== undefined) update.output_tokens = patch.outputTokens;
    if (patch.estimatedCostUsd !== undefined) update.estimated_cost_usd = patch.estimatedCostUsd;
    if (patch.error !== undefined) update.error = patch.error;
    if (patch.completedAt !== undefined) update.completed_at = patch.completedAt;

    const { error } = await this.client
      .from('quiz_generations')
      .update(update)
      .eq('id', generationId);

    if (error) {
      throw new Error(`Failed to update generation: ${error.message}`);
    }
  }

  async insertLedger({ userId, delta, reason, sourceId, metadata = {} }) {
    if (!this.client) {
      if (!this.memory.ledger.some((entry) => entry.userId === userId && entry.sourceId === sourceId && entry.reason === reason)) {
        this.memory.ledger.push({ userId, delta, reason, sourceId, metadata, createdAt: new Date().toISOString() });
      }
      return;
    }

    const { error } = await this.client.from('usage_ledger').insert({
      user_id: userId,
      delta,
      reason,
      source_id: sourceId,
      metadata,
    });

    if (error && error.code !== '23505') {
      throw new Error(`Failed to write credit ledger: ${error.message}`);
    }
  }

  async getCreditGrants(userId) {
    if (!userId) {
      return [];
    }

    if (!this.client) {
      return this.memory.creditGrants
        .filter((grant) => grant.userId === userId)
        .sort((a, b) => {
          const aExpiry = a.expiresAt || '9999-12-31T23:59:59.999Z';
          const bExpiry = b.expiresAt || '9999-12-31T23:59:59.999Z';
          return aExpiry.localeCompare(bExpiry) || a.createdAt.localeCompare(b.createdAt);
        });
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

    return (data || []).map((grant) => ({
      id: grant.id,
      userId: grant.user_id,
      sourceId: grant.source_id,
      grantType: grant.grant_type,
      originalCredits: grant.original_credits,
      remainingCredits: grant.remaining_credits,
      expiresAt: grant.expires_at,
      metadata: grant.metadata || {},
      createdAt: grant.created_at,
    }));
  }

  async insertCreditGrant({ userId, credits, sourceId, grantType = 'manual', expiresAt = null, metadata = {} }) {
    if (!this.client) {
      const existing = this.memory.creditGrants.find(
        (grant) => grant.userId === userId && grant.sourceId === sourceId && grant.grantType === grantType
      );
      if (!existing) {
        this.memory.creditGrants.push({
          id: this.getOperationId(),
          userId,
          sourceId,
          grantType,
          originalCredits: credits,
          remainingCredits: credits,
          expiresAt,
          metadata,
          createdAt: new Date().toISOString(),
        });
      }
      return;
    }

    const { error } = await this.client.from('credit_grants').insert({
      user_id: userId,
      source_id: sourceId,
      grant_type: grantType,
      original_credits: credits,
      remaining_credits: credits,
      expires_at: expiresAt,
      metadata,
    });

    if (error && error.code !== '23505') {
      throw new Error(`Failed to grant AI games: ${error.message}`);
    }
  }

  async updateCreditGrantRemaining(grantId, remainingCredits) {
    if (!this.client) {
      const grant = this.memory.creditGrants.find((item) => item.id === grantId);
      if (grant) {
        grant.remainingCredits = remainingCredits;
      }
      return;
    }

    const { error } = await this.client
      .from('credit_grants')
      .update({ remaining_credits: remainingCredits })
      .eq('id', grantId);

    if (error) {
      throw new Error(`Failed to update AI game grant: ${error.message}`);
    }
  }

  async consumeCreditGrants({ userId, credits }) {
    let remainingToSpend = credits;
    const consumed = [];
    const grants = (await this.getCreditGrants(userId)).filter((grant) => isGrantAvailable(grant));

    if (grants.length === 0 && (await this.getLegacyCreditBalance(userId)) >= credits) {
      return [
        {
          legacy: true,
          userId,
          amount: credits,
        },
      ];
    }

    for (const grant of grants) {
      if (remainingToSpend <= 0) {
        break;
      }

      const amount = Math.min(grant.remainingCredits, remainingToSpend);
      await this.updateCreditGrantRemaining(grant.id, grant.remainingCredits - amount);
      consumed.push({
        grantId: grant.id,
        userId,
        amount,
      });
      remainingToSpend -= amount;
    }

    if (remainingToSpend > 0) {
      throw new Error('You are out of AI games. Upgrade or buy a pack to continue.');
    }

    return consumed;
  }

  async restoreConsumedCreditGrants(consumedGrants) {
    for (const consumed of consumedGrants) {
      if (consumed.legacy) {
        continue;
      }

      const grants = await this.getCreditGrants(consumed.userId);
      const grant = grants.find((item) => item.id === consumed.grantId);
      if (grant) {
        await this.updateCreditGrantRemaining(grant.id, grant.remainingCredits + consumed.amount);
      }
    }
  }

  async grantCredits({ userId, credits, reason, sourceId, metadata = {}, grantType = 'manual', expiresAt = null }) {
    await this.insertCreditGrant({
      userId,
      credits,
      sourceId,
      grantType,
      expiresAt,
      metadata: { ...metadata, reason },
    });

    await this.insertLedger({
      userId,
      delta: credits,
      reason,
      sourceId,
      metadata,
    });
  }

  async recordPayment({ stripeEventId, stripeObjectId, userId, amountTotal, currency, status, metadata = {} }) {
    if (!this.client) {
      if (this.memory.payments.has(stripeEventId)) {
        return false;
      }
      this.memory.payments.add(stripeEventId);
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

  async upsertSubscription({ userId, stripeCustomerId, stripeSubscriptionId, tier, status, currentPeriodEnd }) {
    if (!userId) {
      return;
    }

    if (!this.client) {
      this.memory.subscriptions.set(userId, {
        tier,
        status,
        currentPeriodEnd,
      });
      return;
    }

    const { error } = await this.client.from('subscriptions').upsert(
      {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        tier,
        status,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      throw new Error(`Failed to update subscription: ${error.message}`);
    }
  }
}

module.exports = {
  AiUsageService,
  estimateOpenAiCost,
};
