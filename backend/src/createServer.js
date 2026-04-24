const http = require('http');
const { Server } = require('socket.io');
const { config, isOriginAllowed } = require('./config');
const { SessionStore } = require('./game/sessionStore');
const { GameService } = require('./game/gameService');
const { QuestionService } = require('./quiz/questionService');
const { createApp } = require('./http/createApp');
const { registerSocketHandlers } = require('./socket/registerSocketHandlers');

function logRuntimeMessage(level, message, details = {}) {
  const serializedDetails = Object.keys(details).length ? ` ${JSON.stringify(details)}` : '';
  console[level](`[runtime] ${message}${serializedDetails}`);
}

function createServer() {
  const store = new SessionStore({
    sessionRetentionMs: config.sessionRetentionMs,
    endedSessionRetentionMs: config.endedSessionRetentionMs,
    storeMode: config.storeMode,
    logger(eventName, details) {
      if (config.nodeEnv !== 'production') {
        return;
      }

      console.log(
        `[store:${eventName}] ${JSON.stringify({
          timestamp: new Date().toISOString(),
          ...details,
        })}`
      );
    },
  });

  const questionService = new QuestionService({
    apiKey: config.openAiApiKey,
    model: config.openAiModel,
  });

  const placeholderGameService = {};
  const app = createApp({
    gameService: placeholderGameService,
    store,
    questionService,
    config,
  });

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  });

  const gameService = new GameService({
    io,
    store,
    questionService,
    config,
  });

  placeholderGameService.createSession = gameService.createSession.bind(gameService);
  placeholderGameService.generateQuiz = gameService.generateQuiz.bind(gameService);
  registerSocketHandlers(io, gameService);

  if (config.nodeEnv === 'production') {
    logRuntimeMessage('log', 'Store mode enabled', {
      storeMode: config.storeMode,
      deploymentId: config.railway.deploymentId || null,
      serviceName: config.railway.serviceName || null,
      replicaId: config.railway.replicaId || null,
      replicaRegion: config.railway.replicaRegion || null,
    });
    logRuntimeMessage('warn', 'Single-instance memory mode requires exactly one Railway replica', {
      action: 'keep this service scaled to one replica',
      consequence: 'active sessions do not survive restarts or multi-replica routing',
    });
  }

  const reapInterval = setInterval(() => {
    store.reapExpiredSessions();
  }, 60_000);
  if (typeof reapInterval.unref === 'function') {
    reapInterval.unref();
  }

  return {
    app,
    server,
    io,
    store,
    questionService,
    gameService,
  };
}

module.exports = {
  createServer,
};
