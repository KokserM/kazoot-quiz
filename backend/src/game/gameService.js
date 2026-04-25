const { ZodError } = require('zod');
const {
  createSessionSchema,
  generateQuizSchema,
  joinGameSchema,
  quizSchema,
  submitAnswerSchema,
} = require('../validation/schemas');
const { FixedWindowRateLimiter } = require('../security/rateLimiter');

function buildAnswerStats(players, questionIndex) {
  const stats = [0, 0, 0, 0];

  for (const player of players) {
    const answer = player.answers[questionIndex];
    if (answer) {
      stats[answer.answerIndex] += 1;
    }
  }

  return stats;
}

function haveAllConnectedPlayersAnswered(session) {
  const connectedPlayers = session.getConnectedPlayers();
  if (connectedPlayers.length === 0) {
    return false;
  }

  return connectedPlayers.every((player) => Boolean(player.answers[session.currentQuestionIndex]));
}

function formatValidationError(error) {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join(', ');
  }

  return error.message || 'Invalid request';
}

function getSocketClientIp(socket) {
  return socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() || socket.handshake.address || 'unknown';
}

class GameService {
  constructor({ io, store, questionService, aiUsageService, config }) {
    this.io = io;
    this.store = store;
    this.questionService = questionService;
    this.aiUsageService = aiUsageService;
    this.config = config;
    this.joinRateLimiter = new FixedWindowRateLimiter({
      limit: config.joinRateLimitPerMin,
      windowMs: 60_000,
    });
    this.failedJoinRateLimiter = new FixedWindowRateLimiter({
      limit: config.failedJoinRateLimitPer15Min,
      windowMs: 15 * 60_000,
    });
    this.socketEventRateLimiter = new FixedWindowRateLimiter({
      limit: config.socketEventRateLimitPer10Sec,
      windowMs: 10_000,
    });
  }

  log(eventName, details = {}) {
    if (this.config.nodeEnv !== 'production') {
      return;
    }

    console.log(
      `[game:${eventName}] ${JSON.stringify({
        timestamp: new Date().toISOString(),
        ...details,
      })}`
    );
  }

  async generateQuizForContext({ topic, language }, context = {}) {
    let reservation = null;
    let quiz = null;
    const shouldUseOpenAI = this.questionService.hasOpenAI() && context.user;

    try {
      if (this.questionService.hasOpenAI() && !context.user) {
        quiz = this.questionService.generateDemoQuiz(topic, language);
      } else {
        if (shouldUseOpenAI && this.aiUsageService) {
          reservation = await this.aiUsageService.reserveQuizGeneration({
            user: context.user,
            topic,
            language,
            model: this.config.openAiModel,
            ipAddress: context.ipAddress,
          });
        }

        quiz = await this.questionService.generateQuiz(topic, language);
      }
    } catch (error) {
      if (reservation && this.aiUsageService) {
        await this.aiUsageService.refundQuizGeneration(reservation, error);
      }
      throw error;
    }

    if (reservation && this.aiUsageService) {
      if (quiz.source === 'openai') {
        await this.aiUsageService.completeQuizGeneration(reservation, {
          quiz,
          usage: quiz.usage,
        });
      } else {
        await this.aiUsageService.refundQuizGeneration(
          reservation,
          new Error('OpenAI generation fell back to demo questions')
        );
      }
    }

    return quiz;
  }

  async createSession(payload, context = {}) {
    const { topic, language, questionTimeLimitMs, revealTiming } = createSessionSchema.parse(payload);
    const activeSessions = this.store.getHealthSnapshot().activeSessions;
    if (activeSessions >= this.config.maxActiveSessions) {
      throw new Error('The server is at the active room limit. Try again in a few minutes.');
    }

    const quiz = await this.generateQuizForContext({ topic, language }, context);
    const validatedQuiz = quizSchema.parse(quiz);

    const session = this.store.createSession({
      topic: validatedQuiz.topic,
      language: validatedQuiz.language,
      questions: validatedQuiz.questions,
      questionSource: quiz.source || 'demo',
      questionTimeLimitMs,
      revealTiming,
    });

    return {
      sessionId: session.id,
      topic: session.topic,
      language: session.language,
      questionCount: session.questions.length,
      questionTimeLimitMs: session.questionTimeLimitMs,
      revealTiming: session.revealTiming,
      questionSource: session.questionSource,
    };
  }

  async generateQuiz(payload, context = {}) {
    const { topic, language } = generateQuizSchema.parse(payload);
    return this.generateQuizForContext({ topic, language }, context);
  }

  emitSessionUpdate(session) {
    session.players.forEach((player) => {
      this.emitToPlayer(player, 'session-updated', {
        ...session.toSessionSummary(player.playerId),
        isAdmin: player.isHost,
        playerId: player.playerId,
        activePhaseData: this.buildPhaseSnapshot(session, player),
      });
    });
  }

  emitToPlayer(player, eventName, payload) {
    if (!player?.socketId) {
      return;
    }

    this.io.to(player.socketId).emit(eventName, payload);
  }

  buildQuestionPayload(session, player) {
    const question = session.questions[session.currentQuestionIndex];
    const existingAnswer = player?.answers[session.currentQuestionIndex] || null;

    return {
      roundId: session.currentRoundId,
      questionNumber: session.currentQuestionIndex + 1,
      totalQuestions: session.questions.length,
      question: question.question,
      choices: question.choices,
      timeLimit: session.questionTimeLimitMs,
      revealTiming: session.revealTiming,
      questionStartedAt: session.currentQuestionStartedAt,
      questionEndsAt: session.currentQuestionEndsAt,
      serverTime: Date.now(),
      submittedAnswerIndex: existingAnswer ? existingAnswer.answerIndex : null,
    };
  }

  buildResultsPayload(session, player) {
    const currentQuestion = session.questions[session.currentQuestionIndex];
    const answerStats = buildAnswerStats(session.players.values(), session.currentQuestionIndex);
    const leaderboard = session.toSessionSummary().leaderboard;
    const playerAnswer = player?.answers[session.currentQuestionIndex] || null;

    return {
      roundId: session.currentRoundId,
      correctAnswer: currentQuestion.correctAnswerIndex,
      correctAnswerText: currentQuestion.choices[currentQuestion.correctAnswerIndex],
      answerStats,
      leaderboard,
      isLastQuestion: session.currentQuestionIndex === session.questions.length - 1,
      playerAnswer: playerAnswer ? playerAnswer.answerIndex : null,
      earnedPoints: playerAnswer ? playerAnswer.points : 0,
      answerWasCorrect: playerAnswer ? playerAnswer.isCorrect : false,
      allChoices: currentQuestion.choices,
      revealTiming: session.revealTiming,
    };
  }

  buildPhaseSnapshot(session, player) {
    if (session.gameState === 'question') {
      return this.buildQuestionPayload(session, player);
    }

    if (session.gameState === 'results') {
      return this.buildResultsPayload(session, player);
    }

    if (session.gameState === 'ended') {
      return {
        leaderboard: session.toSessionSummary().leaderboard,
      };
    }

    return null;
  }

  emitPhaseSnapshot(session, player) {
    if (!player) {
      return;
    }

    if (session.gameState === 'question') {
      this.emitToPlayer(player, 'question-start', this.buildQuestionPayload(session, player));
      return;
    }

    if (session.gameState === 'results') {
      this.emitToPlayer(player, 'question-results', this.buildResultsPayload(session, player));
      return;
    }

    if (session.gameState === 'ended') {
      this.emitToPlayer(player, 'game-end', {
        leaderboard: session.toSessionSummary().leaderboard,
      });
    }
  }

  handleRecoveredConnection(socket) {
    const sessionId = socket.data?.sessionId || null;
    const playerId = socket.data?.playerId || null;
    if (!sessionId || !playerId) {
      this.log('recovered_socket_missing_data', {
        socketId: socket.id,
      });
      return;
    }

    const session = this.store.getSession(sessionId);
    const player = session?.players.get(playerId) || null;
    if (!session || !player) {
      this.log('recovered_socket_missing_session', {
        socketId: socket.id,
        sessionId,
        playerId,
      });
      return;
    }

    this.store.bindSocket({
      sessionId,
      playerId,
      socketId: socket.id,
    });
    session.reconnectPlayer(player, socket.id, player.username);
    this.emitSessionUpdate(session);
    this.emitPhaseSnapshot(session, player);
    this.log('recovered_socket_rebound', {
      socketId: socket.id,
      sessionId,
      playerId,
      gameState: session.gameState,
    });
  }

  joinSession(socket, rawPayload) {
    const payload = joinGameSchema.parse(rawPayload);
    const clientIp = getSocketClientIp(socket);
    const joinLimit = this.joinRateLimiter.consume(`${clientIp}:${payload.sessionId}`);
    if (!joinLimit.allowed) {
      throw new Error('Too many join attempts. Please wait a moment and try again.');
    }

    const session = this.store.getSession(payload.sessionId);

    if (!session) {
      const failedLimit = this.failedJoinRateLimiter.consume(`missing:${clientIp}`);
      this.log('join_session_missing', {
        sessionId: payload.sessionId,
        socketId: socket.id,
        username: payload.username,
        knownSessions: this.store.getKnownSessionIds(),
      });
      if (!failedLimit.allowed) {
        throw new Error('Unable to join this room. Check the invite link or room code.');
      }
      throw new Error('Game session not found');
    }

    let player = null;
    let reconnected = false;
    const hostBeforeJoin = session.getHost();

    if (payload.playerToken) {
      player = session.getPlayerByToken(payload.playerToken);
      if (player) {
        if (
          player.username.trim().toLowerCase() !== payload.username.trim().toLowerCase() &&
          session.gameState !== 'waiting'
        ) {
          throw new Error('Saved player token does not match this player name');
        }

        if (session.hasUsernameConflict(payload.username, player.playerId)) {
          throw new Error('That name is already in use');
        }

        player = session.reconnectPlayer(player, socket.id, payload.username);
        reconnected = true;
      }
    }

    if (!player) {
      if (session.gameState !== 'waiting') {
        throw new Error('Game already in progress. Rejoin with your saved player token.');
      }

      const totalConnectedPlayers = this.store.getHealthSnapshot().connectedPlayers;
      if (totalConnectedPlayers >= this.config.maxConnectedPlayers) {
        throw new Error('The server is at the connected player limit. Try again in a few minutes.');
      }

      if (session.players.size >= this.config.maxPlayersPerSession) {
        throw new Error('This room is full.');
      }

      if (session.hasUsernameConflict(payload.username)) {
        throw new Error('That name is already in use');
      }

      player = session.addPlayer({
        username: payload.username,
        socketId: socket.id,
        wantsHost: payload.isCreator,
      });
    }

    socket.join(session.id);
    this.store.bindSocket({
      sessionId: session.id,
      playerId: player.playerId,
      socketId: socket.id,
    });
    socket.data.sessionId = session.id;
    socket.data.playerId = player.playerId;
    socket.data.playerToken = player.playerToken;
    socket.data.hostToken = player.hostToken || null;

    const joinedPayload = {
      ...session.toSessionSummary(player.playerId),
      isAdmin: player.isHost,
      playerId: player.playerId,
      playerToken: player.playerToken,
      hostToken: player.isHost ? player.hostToken : null,
      reconnected,
    };

    socket.emit('joined-game', joinedPayload);
    this.emitSessionUpdate(session);
    this.emitPhaseSnapshot(session, player);
    const hostAfterJoin = session.getHost();
    if (hostAfterJoin && hostBeforeJoin?.playerId !== hostAfterJoin.playerId) {
      this.io.to(session.id).emit('admin-changed', {
        newAdminId: hostAfterJoin.playerId,
        newAdminUsername: hostAfterJoin.username,
        isTemporaryHost: hostAfterJoin.isTemporaryHost,
      });
    }
    this.log('join_session_success', {
      sessionId: session.id,
      playerId: player.playerId,
      username: player.username,
      reconnected,
      isTemporaryHost: player.isTemporaryHost,
      gameState: session.gameState,
      connectedPlayerCount: session.getConnectedPlayers().length,
    });

    if (reconnected) {
      socket.to(session.id).emit('player-reconnected', {
        username: player.username,
        playerId: player.playerId,
        connectedPlayerCount: session.getConnectedPlayers().length,
      });
    } else {
      socket.to(session.id).emit('player-joined', {
        username: player.username,
        playerId: player.playerId,
        connectedPlayerCount: session.getConnectedPlayers().length,
      });
    }

    return joinedPayload;
  }

  startQuestion(session, questionIndex) {
    const question = session.questions[questionIndex];
    session.clearTimer();
    session.gameState = 'question';
    session.currentQuestionIndex = questionIndex;
    session.currentRoundId = `${questionIndex + 1}-${Date.now()}`;
    session.currentQuestionStartedAt = Date.now();
    session.currentQuestionEndsAt =
      session.currentQuestionStartedAt + session.questionTimeLimitMs;
    session.lastResults = null;
    session.touch();

    session.currentQuestionTimer = setTimeout(() => {
      this.finishQuestion(session.id, session.currentRoundId);
    }, session.questionTimeLimitMs);

    session.players.forEach((player) => {
      this.emitToPlayer(player, 'question-start', this.buildQuestionPayload(session, player));
    });

    this.emitSessionUpdate(session);
    this.log('question_started', {
      sessionId: session.id,
      roundId: session.currentRoundId,
      questionIndex,
      connectedPlayerCount: session.getConnectedPlayers().length,
      endsAt: session.currentQuestionEndsAt,
      revealTiming: session.revealTiming,
    });
    return question;
  }

  startGame(socketId) {
    const { session, player } = this.store.getBySocketId(socketId);
    if (!session || !player) {
      throw new Error('You are not in a game');
    }

    if (!player.isHost) {
      throw new Error('Only the game host can start the game');
    }

    if (session.gameState !== 'waiting') {
      throw new Error('Game has already started');
    }

    this.startQuestion(session, 0);
  }

  submitAnswer(socketId, rawPayload) {
    const payload = submitAnswerSchema.parse(rawPayload);
    const { session, player } = this.store.getBySocketId(socketId);

    if (!session || !player) {
      throw new Error('You are not in a game');
    }

    if (session.gameState !== 'question') {
      throw new Error('No active question');
    }

    if (payload.roundId !== session.currentRoundId) {
      throw new Error('This question has already ended');
    }

    if (Date.now() > session.currentQuestionEndsAt) {
      throw new Error('This question has already ended');
    }

    const questionIndex = session.currentQuestionIndex;
    if (player.answers[questionIndex]) {
      return {
        accepted: true,
        alreadySubmitted: true,
      };
    }

    const question = session.questions[questionIndex];
    const isCorrect = payload.answerIndex === question.correctAnswerIndex;
    const timeRemainingMs = Math.max(0, session.currentQuestionEndsAt - Date.now());
    const points = isCorrect
      ? Math.round(1000 + (timeRemainingMs / 1000) * 50)
      : 0;

    player.answers[questionIndex] = {
      roundId: session.currentRoundId,
      answerIndex: payload.answerIndex,
      isCorrect,
      points,
      submittedAt: Date.now(),
    };
    player.score += points;
    session.touch();
    this.log('answer_submitted', {
      sessionId: session.id,
      roundId: session.currentRoundId,
      playerId: player.playerId,
      answerIndex: payload.answerIndex,
      isCorrect,
      points,
      timeRemainingMs,
    });

    if (session.revealTiming === 'all_answered' && haveAllConnectedPlayersAnswered(session)) {
      this.log('all_connected_players_answered', {
        sessionId: session.id,
        roundId: session.currentRoundId,
        connectedPlayerCount: session.getConnectedPlayers().length,
      });
      this.finishQuestion(session.id, session.currentRoundId);
    }

    return {
      accepted: true,
      alreadySubmitted: false,
    };
  }

  finishQuestion(sessionId, expectedRoundId) {
    const session = this.store.getSession(sessionId);
    if (!session) {
      this.log('finish_question_missing_session', {
        sessionId,
        expectedRoundId,
      });
      return;
    }

    if (session.gameState !== 'question' || session.currentRoundId !== expectedRoundId) {
      this.log('finish_question_skipped', {
        sessionId,
        expectedRoundId,
        actualRoundId: session.currentRoundId,
        gameState: session.gameState,
      });
      return;
    }

    session.clearTimer();
    session.gameState = 'results';
    session.touch();

    const answerStats = buildAnswerStats(session.players.values(), session.currentQuestionIndex);
    this.log('question_finished', {
      sessionId,
      roundId: expectedRoundId,
      questionIndex: session.currentQuestionIndex,
      answerStats,
      connectedPlayerCount: session.getConnectedPlayers().length,
    });

    session.players.forEach((player) => {
      this.emitToPlayer(player, 'question-results', this.buildResultsPayload(session, player));
    });

    this.emitSessionUpdate(session);
  }

  advance(socketId) {
    const { session, player } = this.store.getBySocketId(socketId);
    if (!session || !player) {
      throw new Error('You are not in a game');
    }

    if (!player.isHost) {
      throw new Error('Only the game host can continue');
    }

    if (session.gameState !== 'results') {
      throw new Error('Wait for the results screen before continuing');
    }

    if (session.currentQuestionIndex >= session.questions.length - 1) {
      session.clearTimer();
      session.gameState = 'ended';
      session.endedAt = Date.now();
      session.touch();
      const leaderboard = session.toSessionSummary().leaderboard;
      this.io.to(session.id).emit('game-end', { leaderboard });
      this.emitSessionUpdate(session);
      return;
    }

    this.startQuestion(session, session.currentQuestionIndex + 1);
  }

  handleDisconnect(socketId) {
    const { session, player } = this.store.unbindSocket(socketId);
    if (!session || !player) {
      return;
    }

    const oldHostId = session.getHost()?.playerId || null;
    session.markDisconnected(player.playerId);
    const newHost = session.getHost();

    this.io.to(session.id).emit('player-left', {
      username: player.username,
      playerId: player.playerId,
      connectedPlayerCount: session.getConnectedPlayers().length,
    });

    if (oldHostId && newHost && oldHostId !== newHost.playerId) {
      this.io.to(session.id).emit('admin-changed', {
        newAdminId: newHost.playerId,
        newAdminUsername: newHost.username,
      });
    }

    if (session.revealTiming === 'all_answered' && haveAllConnectedPlayersAnswered(session)) {
      this.log('all_connected_players_answered_after_disconnect', {
        sessionId: session.id,
        roundId: session.currentRoundId,
        connectedPlayerCount: session.getConnectedPlayers().length,
      });
      this.finishQuestion(session.id, session.currentRoundId);
      return;
    }

    this.emitSessionUpdate(session);
  }

  wrapSocketHandler(socket, handler) {
    return async (payload = {}) => {
      try {
        const clientIp = getSocketClientIp(socket);
        const eventLimit = this.socketEventRateLimiter.consume(`${clientIp}:${socket.id}`);
        if (!eventLimit.allowed) {
          throw new Error('Too many socket actions. Please slow down.');
        }
        await handler(payload);
      } catch (error) {
        socket.emit('error', { message: formatValidationError(error) });
      }
    };
  }
}

module.exports = {
  GameService,
  formatValidationError,
};
