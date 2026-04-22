const http = require('http');
const { Server } = require('socket.io');
const { config, isOriginAllowed } = require('./config');
const { SessionStore } = require('./game/sessionStore');
const { GameService } = require('./game/gameService');
const { QuestionService } = require('./quiz/questionService');
const { createApp } = require('./http/createApp');
const { registerSocketHandlers } = require('./socket/registerSocketHandlers');

function createServer() {
  const store = new SessionStore({
    sessionRetentionMs: config.sessionRetentionMs,
    endedSessionRetentionMs: config.endedSessionRetentionMs,
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
