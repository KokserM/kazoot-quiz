const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { monitorEventLoopDelay } = require('perf_hooks');
const { isOriginAllowed } = require('../config');
const { FixedWindowRateLimiter } = require('../security/rateLimiter');
const { toClientError, UserFacingError } = require('../errors');
const { listDemoQuizzes } = require('../quiz/demoQuizzes');
const { CLIENT_EVENTS } = require('../observability/metrics');
const { sessionIdSchema } = require('../validation/schemas');

const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
eventLoopDelay.enable();

function resolveFrontendDir() {
  return path.join(__dirname, '../../../frontend/dist');
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || '';
}

function createApp({ gameService, store, questionService, authService, aiUsageService, billingService, config, logger, metrics, lifecycle }) {
  const app = express();
  const limiters = {
    create: new FixedWindowRateLimiter({ limit: config.createSessionRateLimitPer15Min, windowMs: 15 * 60_000 }),
    demo: new FixedWindowRateLimiter({ limit: config.demoRateLimitPer15Min, windowMs: 15 * 60_000 }),
    events: new FixedWindowRateLimiter({ limit: 60, windowMs: 10 * 60_000 }),
    billing: new FixedWindowRateLimiter({ limit: 20, windowMs: 15 * 60_000 }),
  };
  lifecycle?.onPrune?.(() => Object.values(limiters).forEach((limiter) => limiter.prune()));

  function sendError(res, error, context) {
    const clientError = toClientError(error);
    if (clientError.status >= 500) {
      logger.error('http_request_failed', { route: context, message: error.message, stack: error.stack });
    }
    res.status(clientError.status).json({ error: clientError.message, code: clientError.code });
  }

  function limit(limiter, key) {
    if (!limiter.consume(key).allowed) {
      throw new UserFacingError('Too many requests. Please wait a few minutes and try again.', { status: 429, code: 'rate_limited' });
    }
  }

  async function requireUser(req) {
    const user = authService ? await authService.getUserFromRequest(req) : null;
    if (!user) {
      throw new UserFacingError('Please sign in first.', { status: 401, code: 'auth_required' });
    }
    return user;
  }

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && !isOriginAllowed(origin)) {
      res.status(403).json({ error: 'Origin not allowed' });
      return;
    }
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https://lh3.googleusercontent.com'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", config.supabaseUrl || 'https://*.supabase.co', 'https://*.supabase.co', 'wss://*.supabase.co'].filter(Boolean),
          formAction: ["'self'", 'https://checkout.stripe.com', 'https://billing.stripe.com'],
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(cors({ origin: (origin, callback) => callback(null, isOriginAllowed(origin)), credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE'] }));

  // Stripe needs the raw body; keep this route before express.json().
  app.post('/api/billing/webhook', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
    let event;
    try {
      event = billingService.constructWebhookEvent(req.body, req.get('stripe-signature'));
    } catch (error) {
      logger.warn('stripe_webhook_rejected', { message: error.message });
      res.status(400).json({ error: 'Invalid webhook' });
      return;
    }
    try {
      await billingService.handleWebhookEvent(event);
      logger.info('stripe_webhook_processed', { eventId: event.id, type: event.type, livemode: event.livemode });
      res.json({ received: true });
    } catch (error) {
      // 500 makes Stripe retry with backoff; handlers are idempotent.
      logger.error('stripe_webhook_failed', { eventId: event.id, type: event.type, message: error.message });
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });
  app.use(express.json({ limit: '64kb' }));

  // Liveness: the process is up. Railway's healthcheck points here.
  app.get('/health', (req, res) => {
    const snapshot = store.getHealthSnapshot();
    const memory = process.memoryUsage();
    const heapUsedMb = Math.round(memory.heapUsed / 1024 / 1024);
    const degradedReasons = [];
    if (snapshot.activeSessions >= config.degradedActiveSessions) degradedReasons.push('active_sessions_high');
    if (snapshot.connectedPlayers >= config.degradedConnectedPlayers) degradedReasons.push('connected_players_high');
    if (heapUsedMb >= config.degradedHeapUsedMb) degradedReasons.push('heap_used_high');
    const base = {
      status: degradedReasons.length ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
    if (config.nodeEnv === 'production' && !config.detailedHealthEnabled) {
      res.json(base);
      return;
    }
    res.json({
      ...base,
      ...snapshot,
      degradedReasons,
      limits: {
        maxActiveSessions: config.maxActiveSessions,
        maxPlayersPerSession: config.maxPlayersPerSession,
        maxConnectedPlayers: config.maxConnectedPlayers,
      },
      process: {
        memory: { rssMb: Math.round(memory.rss / 1024 / 1024), heapUsedMb },
        eventLoopDelayMs: Math.round((eventLoopDelay.mean || 0) / 1_000_000),
      },
      openAiEnabled: questionService.hasOpenAI(),
      authEnabled: authService?.isConfigured() || false,
      billingEnabled: billingService?.isConfigured() || false,
    });
  });

  // Readiness: accepting new games. Fails while shutting down.
  app.get('/ready', (req, res) => {
    if (gameService.isShuttingDown) {
      res.status(503).json({ status: 'shutting_down' });
      return;
    }
    res.json({ status: 'ready' });
  });

  app.get('/diagnostics/sessions', (req, res) => {
    const allowed =
      config.nodeEnv !== 'production' ||
      Boolean(config.diagnosticsSecret && req.get('x-diagnostics-secret') === config.diagnosticsSecret);
    if (!allowed) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ storeMode: store.getStoreMode(), integrityIssues: store.auditIntegrity(), sessions: store.getSessionDiagnostics() });
  });

  // Public configuration for the frontend.
  app.get('/api/config', (req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      aiAvailable: questionService.hasOpenAI(),
      freeAiGamesPerMonth: config.freeAiGamesPerMonth,
      demoQuizzes: listDemoQuizzes(),
      maxPlayersPerRoom: config.maxPlayersPerSession,
      maxDemoPlayers: Math.min(config.maxDemoPlayers, config.maxPlayersPerSession),
      billingAvailable: billingService.isConfigured(),
      billingTestMode: billingService.isTestMode(),
    });
  });

  app.get('/api/billing/catalog', (req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ plans: billingService.getCatalog() });
  });

  app.get('/api/me/usage', async (req, res) => {
    try {
      const user = await requireUser(req);
      res.set('Cache-Control', 'no-store');
      res.json({ user: { id: user.id, displayName: user.displayName }, usage: await aiUsageService.getUsageSummary(user.id) });
    } catch (error) {
      sendError(res, error, 'me_usage');
    }
  });

  async function handleCheckout(req, res) {
    try {
      limit(limiters.billing, `checkout:${getClientIp(req)}`);
      const user = await requireUser(req);
      const session = await billingService.createCheckoutSession({
        user,
        planId: req.body?.planId,
        acceptedImmediateSupply: req.body?.acceptedImmediateSupply,
      });
      metrics.track('checkout_created', { plan: String(req.body?.planId || '') });
      res.json(session);
    } catch (error) {
      sendError(res, error, 'checkout');
    }
  }
  app.post('/api/billing/checkout', handleCheckout);
  app.post('/api/billing/create-checkout-session', handleCheckout);

  app.post('/api/billing/portal', async (req, res) => {
    try {
      limit(limiters.billing, `portal:${getClientIp(req)}`);
      const user = await requireUser(req);
      res.json(await billingService.createPortalSession({ user }));
    } catch (error) {
      sendError(res, error, 'portal');
    }
  });

  app.delete('/api/me', async (req, res) => {
    try {
      const user = await requireUser(req);
      const subscription = await aiUsageService.getSubscription(user.id);
      if (subscription && ['active', 'trialing', 'past_due'].includes(subscription.status) && !subscription.cancelAtPeriodEnd) {
        throw new UserFacingError('Please cancel your subscription under “Manage billing” before deleting your account.', {
          status: 409,
          code: 'subscription_active',
        });
      }
      await authService.deleteUser(user.id);
      logger.info('account_deleted', {});
      res.json({ deleted: true });
    } catch (error) {
      sendError(res, error, 'delete_account');
    }
  });

  app.post('/api/create-session', async (req, res) => {
    try {
      const isDemo = Boolean(req.body?.demoId);
      limit(isDemo ? limiters.demo : limiters.create, `${isDemo ? 'demo' : 'create'}:${getClientIp(req)}`);
      const user = isDemo ? null : await authService.getUserFromRequest(req);
      res.json(await gameService.createSession(req.body, { user, ipAddress: getClientIp(req) }));
    } catch (error) {
      sendError(res, error, 'create_session');
    }
  });

  app.post('/api/sessions/:sessionId/next', async (req, res) => {
    try {
      const isDemo = Boolean(req.body?.demoId);
      limit(isDemo ? limiters.demo : limiters.create, `${isDemo ? 'demo' : 'create'}:${getClientIp(req)}`);
      const user = isDemo ? null : await authService.getUserFromRequest(req);
      res.json(
        await gameService.createSuccessorSession(
          { ...req.body, sourceSessionId: req.params.sessionId },
          { user, ipAddress: getClientIp(req) }
        )
      );
    } catch (error) {
      sendError(res, error, 'next_session');
    }
  });

  // Teacher/facilitator review. The host token travels in a header, not the URL.
  app.get('/api/sessions/:sessionId/review', (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      const sessionId = sessionIdSchema.parse(req.params.sessionId);
      res.json(gameService.getQuestionsForReview(sessionId, req.get('x-host-token')));
    } catch (error) {
      sendError(res, error, 'review_get');
    }
  });

  app.put('/api/sessions/:sessionId/review', (req, res) => {
    try {
      const sessionId = sessionIdSchema.parse(req.params.sessionId);
      res.json(gameService.updateQuestionsForReview(sessionId, req.get('x-host-token'), req.body));
    } catch (error) {
      sendError(res, error, 'review_put');
    }
  });

  app.post('/api/events', (req, res) => {
    try {
      limit(limiters.events, `events:${getClientIp(req)}`);
      const name = String(req.body?.name || '');
      if (CLIENT_EVENTS.has(name)) {
        metrics.track(name, req.body?.props || {});
      }
      res.status(204).end();
    } catch (error) {
      res.status(204).end();
    }
  });

  app.post('/api/client-errors', (req, res) => {
    if (limiters.events.consume(`errors:${getClientIp(req)}`).allowed) {
      logger.warn('client_error', {
        message: String(req.body?.message || '').slice(0, 300),
        stack: String(req.body?.stack || '').slice(0, 1500),
        path: String(req.body?.path || '').replace(/[?#].*$/, '').slice(0, 120),
        release: String(req.body?.release || '').slice(0, 40),
      });
    }
    res.status(204).end();
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found', code: 'not_found' });
  });

  if (config.nodeEnv === 'production') {
    const frontendDir = resolveFrontendDir();
    const indexHtml = path.join(frontendDir, 'index.html');
    app.use(
      '/assets',
      express.static(path.join(frontendDir, 'assets'), { immutable: true, maxAge: '365d', fallthrough: false })
    );
    app.use(express.static(frontendDir, { index: false, maxAge: '1h' }));
    app.get('*', (req, res) => {
      if (!fs.existsSync(indexHtml)) {
        res.status(503).send('Frontend build missing');
        return;
      }
      res.set('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  return app;
}

module.exports = {
  createApp,
};
