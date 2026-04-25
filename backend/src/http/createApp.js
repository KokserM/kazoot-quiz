const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { monitorEventLoopDelay } = require('perf_hooks');
const { isOriginAllowed } = require('../config');
const { formatValidationError } = require('../game/gameService');
const { FixedWindowRateLimiter } = require('../security/rateLimiter');

const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
eventLoopDelay.enable();

function resolveFrontendDir() {
  const distDir = path.join(__dirname, '../../../frontend/dist');
  if (fs.existsSync(distDir)) {
    return distDir;
  }

  return path.join(__dirname, '../../../frontend/build');
}

function createCorsOptions() {
  return {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST'],
  };
}

function rejectDisallowedBrowserOrigins(req, res, next) {
  const origin = req.get('origin');
  if (origin && !isOriginAllowed(origin)) {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }

  next();
}

async function getOptionalUser(req, authService) {
  if (!authService) {
    return null;
  }

  return authService.getUserFromRequest(req);
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || '';
}

function requireDiagnosticsAccess(req, config) {
  if (config.nodeEnv !== 'production') {
    return true;
  }

  return Boolean(config.diagnosticsSecret && req.get('x-diagnostics-secret') === config.diagnosticsSecret);
}

function createApp({ gameService, store, questionService, authService, aiUsageService, billingService, config }) {
  const app = express();
  const corsOptions = createCorsOptions();
  const createSessionLimiter = new FixedWindowRateLimiter({
    limit: config.createSessionRateLimitPer15Min,
    windowMs: 15 * 60_000,
  });

  app.set('trust proxy', config.trustProxy);
  app.use(rejectDisallowedBrowserOrigins);
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
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: [
            "'self'",
            config.frontendUrl || "'self'",
            config.supabaseUrl || 'https://*.supabase.co',
            'https://*.supabase.co',
            'wss://*.supabase.co',
            'https://api.stripe.com',
            'https://checkout.stripe.com',
          ].filter(Boolean),
          formAction: ["'self'", 'https://checkout.stripe.com'],
        },
      },
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(cors(corsOptions));
  // Stripe needs the unparsed body; keep this route before express.json().
  app.post('/api/billing/webhook', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
    try {
      const event = billingService.constructWebhookEvent(req.body, req.get('stripe-signature'));
      await billingService.handleWebhookEvent(event);
      res.json({ received: true });
    } catch (error) {
      console.error('Stripe webhook failed:', error.message);
      res.status(400).json({ error: 'Invalid webhook' });
    }
  });
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => {
    const healthSnapshot = store.getHealthSnapshot();
    const memoryUsage = process.memoryUsage();
    const heapUsedMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const eventLoopMeanMs = eventLoopDelay.mean / 1_000_000;
    const eventLoopDelayMs = Number.isFinite(eventLoopMeanMs) ? Math.round(eventLoopMeanMs) : 0;
    const degradedReasons = [];

    if (healthSnapshot.activeSessions >= config.degradedActiveSessions) {
      degradedReasons.push('active_sessions_high');
    }
    if (healthSnapshot.connectedPlayers >= config.degradedConnectedPlayers) {
      degradedReasons.push('connected_players_high');
    }
    if (heapUsedMb >= config.degradedHeapUsedMb) {
      degradedReasons.push('heap_used_high');
    }

    const statusPayload = {
      status: degradedReasons.length ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };

    if (config.nodeEnv === 'production' && !config.detailedHealthEnabled) {
      res.status(200).json(statusPayload);
      return;
    }

    res.status(200).json({
      ...statusPayload,
      ...healthSnapshot,
      limits: {
        maxActiveSessions: config.maxActiveSessions,
        maxPlayersPerSession: config.maxPlayersPerSession,
        maxConnectedPlayers: config.maxConnectedPlayers,
      },
      degradedReasons,
      process: {
        memory: {
          rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
          heapUsedMb,
          heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
        eventLoopDelayMs,
      },
      openAiEnabled: questionService.hasOpenAI(),
      authEnabled: authService?.isConfigured() || false,
      billingEnabled: billingService?.isConfigured() || false,
      aiUsage: {
        freeAiGamesPerDay: config.freeAiGamesPerDay,
        aiCreditCostPerQuiz: config.aiCreditCostPerQuiz,
        dailyOpenAiBudgetUsd: config.dailyOpenAiBudgetUsd,
      },
      railway: {
        serviceName: config.railway.serviceName || null,
        replicaId: config.railway.replicaId || null,
        replicaRegion: config.railway.replicaRegion || null,
        deploymentId: config.railway.deploymentId || null,
      },
    });
  });

  app.get('/diagnostics/sessions', (req, res) => {
    if (!requireDiagnosticsAccess(req, config)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

      res.status(200).json({
        storeMode: store.getStoreMode(),
        socketIndexSize: store.getSocketIndexSize(),
        integrityIssues: store.auditIntegrity(),
        sessions: store.getSessionDiagnostics(),
      });
    });

  app.get('/api/demo-topics', (req, res) => {
    const demoQuestions = require('../../demoQuestions');
    res.json({
      topics: Object.keys(demoQuestions),
      hasOpenAI: questionService.hasOpenAI(),
      model: config.openAiModel,
    });
  });

  app.get('/api/billing/catalog', (req, res) => {
    res.json({
      plans: billingService.getCatalog(),
    });
  });

  app.get('/api/me/usage', async (req, res) => {
    try {
      const user = await getOptionalUser(req, authService);
      if (!user) {
        res.status(401).json({ error: 'Sign in to view AI usage.' });
        return;
      }

      res.json({
        user,
        usage: await aiUsageService.getUsageSummary(user.id),
      });
    } catch (error) {
      res.status(400).json({ error: formatValidationError(error) });
    }
  });

  app.post('/api/billing/create-checkout-session', async (req, res) => {
    try {
      const user = await getOptionalUser(req, authService);
      if (!user) {
        res.status(401).json({ error: 'Sign in to manage billing.' });
        return;
      }

      const session = await billingService.createCheckoutSession({
        user,
        planId: req.body.planId,
      });
      res.json(session);
    } catch (error) {
      res.status(400).json({ error: formatValidationError(error) });
    }
  });

  app.post('/api/generate-quiz', async (req, res) => {
    try {
      const limit = createSessionLimiter.consume(`generate:${getClientIp(req)}`);
      if (!limit.allowed) {
        res.status(429).json({ error: 'Too many quiz generation attempts. Please try again later.' });
        return;
      }

      const user = await getOptionalUser(req, authService);
      if (questionService.hasOpenAI() && !user) {
        res.status(401).json({ error: 'Sign in to generate AI questions. Demo games are free.' });
        return;
      }

      const quiz = await gameService.generateQuiz(req.body, {
        user,
        ipAddress: getClientIp(req),
      });
      res.json(quiz);
    } catch (error) {
      res.status(400).json({ error: formatValidationError(error) });
    }
  });

  app.post('/api/create-session', async (req, res) => {
    try {
      const limit = createSessionLimiter.consume(`create:${getClientIp(req)}`);
      if (!limit.allowed) {
        res.status(429).json({ error: 'Too many rooms created from this network. Please try again later.' });
        return;
      }

      const user = await getOptionalUser(req, authService);
      const session = await gameService.createSession(req.body, {
        user,
        ipAddress: getClientIp(req),
      });
      res.json(session);
    } catch (error) {
      res.status(400).json({ error: formatValidationError(error) });
    }
  });

  if (config.nodeEnv === 'production') {
    const frontendDir = resolveFrontendDir();
    app.use(express.static(frontendDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendDir, 'index.html'));
    });
  }

  return app;
}

module.exports = {
  createApp,
};
