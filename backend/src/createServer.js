const http = require('http');
const { Server } = require('socket.io');
const { config: baseConfig, isOriginAllowed } = require('./config');
const { SessionStore } = require('./game/sessionStore');
const { GameService } = require('./game/gameService');
const { QuestionService } = require('./quiz/questionService');
const { createApp } = require('./http/createApp');
const { registerSocketHandlers } = require('./socket/registerSocketHandlers');
const { SupabaseAuthService } = require('./auth/supabaseAuth');
const { AiUsageService } = require('./billing/aiUsageService');
const { StripeBillingService } = require('./billing/stripeBillingService');
const { createLogger } = require('./observability/logger');
const { Metrics } = require('./observability/metrics');

// overrides.config: partial config merged over the environment config (tests).
// overrides.<service>: replacement service instances (tests).
function createServer(overrides = {}) {
  const config = { ...baseConfig, ...(overrides.config || {}) };
  const logger = overrides.logger || createLogger({ silent: config.nodeEnv === 'test' });

  const store = new SessionStore({
    sessionRetentionMs: config.sessionRetentionMs,
    endedSessionRetentionMs: config.endedSessionRetentionMs,
    storeMode: config.storeMode,
    logger: (event, details) => logger.info(`store_${event}`, details),
  });
  const questionService =
    overrides.questionService || new QuestionService({ apiKey: config.openAiApiKey, model: config.openAiModel, config });
  const authService = overrides.authService || new SupabaseAuthService({ config });
  const aiUsageService = overrides.aiUsageService || new AiUsageService({ config });
  const billingService =
    overrides.billingService ||
    new StripeBillingService({ config, aiUsageService, client: overrides.stripeClient, logger });
  const metrics = new Metrics({
    logger,
    sink: (name, props) => aiUsageService.recordProductEvent(name, props),
    flushIntervalMs: config.nodeEnv === 'test' ? 0 : 5 * 60_000,
  });

  const pruneCallbacks = [];
  const server = http.createServer();
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
      credentials: true,
      methods: ['GET', 'POST'],
    },
    // Reconnecting clients always re-join with their seat token and receive a full
    // snapshot, so Socket.IO's packet-replay recovery is not needed.
    pingInterval: config.socketPingIntervalMs,
    pingTimeout: config.socketPingTimeoutMs,
    maxHttpBufferSize: 16 * 1024,
  });

  const gameService = new GameService({ io, store, questionService, aiUsageService, config, logger, metrics });
  registerSocketHandlers(io, gameService);

  const app = createApp({
    gameService,
    store,
    questionService,
    authService,
    aiUsageService,
    billingService,
    config,
    logger,
    metrics,
    lifecycle: { onPrune: (callback) => pruneCallbacks.push(callback) },
  });
  // Socket.IO handles its own path first; everything else goes to Express.
  server.on('request', app);

  const maintenance = setInterval(() => {
    store.reapExpiredSessions();
    gameService.pruneRateLimiters();
    pruneCallbacks.forEach((callback) => callback());
  }, 60_000);
  maintenance.unref();

  // Crash recovery for credits: settle reservations whose process died mid-generation.
  const sweeper = setInterval(() => {
    aiUsageService
      .releaseStaleReservations()
      .then((count) => count && logger.warn('stale_reservations_released', { count }))
      .catch((error) => logger.error('stale_reservation_sweep_failed', { message: error.message }));
  }, 5 * 60_000);
  sweeper.unref();

  if (config.nodeEnv !== 'test') {
    metrics.start();
  }

  let shuttingDown = null;
  // Tell clients, stop accepting work, then close. Railway sends SIGTERM and waits
  // RAILWAY_DEPLOYMENT_DRAINING_SECONDS before SIGKILL (default 0, so set it).
  function shutdown(reason = 'signal') {
    if (shuttingDown) return shuttingDown;
    logger.warn('shutdown_started', { reason, activeSessions: store.sessions.size });
    gameService.notifyShutdown();
    shuttingDown = (async () => {
      clearInterval(maintenance);
      clearInterval(sweeper);
      metrics.stop();
      await metrics.flush();
      // Give the restart notice a moment to reach clients.
      await new Promise((resolve) => setTimeout(resolve, Math.min(1500, config.shutdownGraceMs)));
      store.sessions.forEach((session) => session.clearAllTimers());
      await new Promise((resolve) => {
        const force = setTimeout(resolve, config.shutdownGraceMs);
        force.unref();
        io.close(() => {
          clearTimeout(force);
          resolve();
        });
      });
      logger.warn('shutdown_complete', {});
    })();
    return shuttingDown;
  }

  return {
    app,
    server,
    io,
    config,
    store,
    questionService,
    authService,
    aiUsageService,
    billingService,
    gameService,
    metrics,
    logger,
    shutdown,
  };
}

module.exports = {
  createServer,
};
