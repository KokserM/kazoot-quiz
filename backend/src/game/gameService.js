const {
  advanceSchema,
  createNextSessionSchema,
  createSessionSchema,
  joinGameSchema,
  quizSchema,
  reviewUpdateSchema,
  submitAnswerSchema,
} = require('../validation/schemas');
const { FixedWindowRateLimiter } = require('../security/rateLimiter');
const { UserFacingError, toClientError } = require('../errors');

// Protocol (server -> client):
//   joined-game       to the joining socket: summary + your seat credentials
//   session-updated   room-wide summary (no answers, no tokens)
//   question-start    room-wide question (never includes the correct answer)
//   answer-progress   room-wide count of answers in this round
//   question-results  room-wide reveal: correct answer, stats, leaderboard
//   round-result      to one player: their pick and points for the round
//   game-end          room-wide final leaderboard
//   state-snapshot    to one socket: everything needed to redraw after reconnect
//   next-game-ready   to one player: seat in the successor room
//   server-restarting room-wide notice before a deploy/restart
// Client actions carry an acknowledgement callback: { ok: true, ... } or
// { ok: false, code, message }. Nothing is reported as accepted unless the server
// accepted it.

function points(timeRemainingMs, timeLimitMs) {
  // 500-1000 points for a correct answer, more for answering sooner.
  const ratio = Math.max(0, Math.min(1, timeRemainingMs / timeLimitMs));
  return Math.round(500 + 500 * ratio);
}

// Only the entry appended by our own proxy is trustworthy; earlier entries are
// whatever the client sent. With TRUST_PROXY=1 (Railway) that is the last entry.
function getSocketClientIp(socket, trustProxy) {
  const hops = Number(trustProxy);
  const forwarded = String(socket.handshake.headers['x-forwarded-for'] || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (Number.isInteger(hops) && hops > 0 && forwarded.length >= hops) {
    return forwarded[forwarded.length - hops];
  }
  return socket.handshake.address || 'unknown';
}

class GameService {
  constructor({ io, store, questionService, aiUsageService, config, logger, metrics }) {
    this.io = io;
    this.store = store;
    this.questionService = questionService;
    this.aiUsageService = aiUsageService;
    this.config = config;
    this.logger = logger || { info() {}, warn() {}, error() {} };
    this.metrics = metrics || { track() {}, count() {} };
    this.joinRateLimiter = new FixedWindowRateLimiter({ limit: config.joinRateLimitPerMin, windowMs: 60_000 });
    this.failedJoinRateLimiter = new FixedWindowRateLimiter({ limit: config.failedJoinRateLimitPer15Min, windowMs: 15 * 60_000 });
    this.socketEventRateLimiter = new FixedWindowRateLimiter({ limit: config.socketEventRateLimitPer10Sec, windowMs: 10_000 });
    this.isShuttingDown = false;
  }

  pruneRateLimiters() {
    this.joinRateLimiter.prune();
    this.failedJoinRateLimiter.prune();
    this.socketEventRateLimiter.prune();
  }

  // ----------------------------------------------------------- quiz creation

  assertCapacity() {
    if (this.isShuttingDown) {
      throw new UserFacingError('Kazoot is restarting for an update. Please try again in a minute.', { status: 503, code: 'restarting' });
    }
    if (this.store.sessions.size >= this.config.maxActiveSessions) {
      throw new UserFacingError('Kazoot is very busy right now. Please try again in a few minutes.', { status: 503, code: 'at_capacity' });
    }
  }

  async buildQuiz({ topic, demoId, language, difficulty }, context) {
    if (demoId) {
      return this.questionService.getDemoQuiz(demoId);
    }

    if (!context.user) {
      throw new UserFacingError('Sign in to create a quiz on your own topic. The demo quizzes are free without an account.', {
        status: 401,
        code: 'auth_required',
      });
    }
    if (!this.questionService.hasOpenAI()) {
      throw new UserFacingError('Creating new quizzes is unavailable right now. The demo quizzes still work.', {
        status: 503,
        code: 'provider_unavailable',
      });
    }

    const reservation = await this.aiUsageService.reserveQuizGeneration({
      user: context.user,
      topic,
      language,
      model: this.config.openAiModel,
      ipAddress: context.ipAddress,
    });

    let quiz;
    try {
      quiz = await this.questionService.generateQuiz({ topic, language, difficulty });
    } catch (error) {
      await this.aiUsageService.releaseQuizGeneration(reservation, error, { usage: error.usage || {} }).catch((releaseError) => {
        this.logger.error('credit_release_failed', { generationId: reservation.generationId, message: releaseError.message });
      });
      this.logger.warn('generation_failed', { generationId: reservation.generationId, code: error.code, message: error.message });
      this.metrics.track('generation_failed', { code: error.code || 'unknown' });
      throw error;
    }

    const completed = await this.aiUsageService.completeQuizGeneration(reservation, { usage: quiz.usage });
    if (!completed) {
      // The reservation was released meanwhile (e.g. the stale-reservation sweeper).
      throw new UserFacingError('That took too long and was cancelled. You were not charged. Please try again.', {
        status: 504,
        code: 'reservation_expired',
      });
    }
    this.logger.info('generation_succeeded', {
      generationId: reservation.generationId,
      mode: reservation.mode,
      attempts: quiz.usage?.attempts,
      inputTokens: quiz.usage?.inputTokens,
      outputTokens: quiz.usage?.outputTokens,
    });
    return quiz;
  }

  createRoom(quiz, options) {
    const validated = quizSchema.parse({ topic: quiz.topic, language: quiz.language, questions: quiz.questions });
    const isDemo = quiz.source === 'demo';
    return this.store.createSession({
      topic: validated.topic,
      language: validated.language,
      questions: validated.questions,
      questionSource: quiz.source,
      questionTimeLimitMs: options.questionTimeLimitMs,
      revealTiming: options.revealTiming,
      reviewMode: options.reviewMode,
      isDemo,
      demoId: quiz.demoId || null,
      maxPlayers: isDemo ? Math.min(this.config.maxDemoPlayers, this.config.maxPlayersPerSession) : this.config.maxPlayersPerSession,
      hostGraceMs: this.config.hostGraceMs,
    });
  }

  async createSession(payload, context = {}) {
    const options = createSessionSchema.parse(payload);
    this.assertCapacity();
    const quiz = await this.buildQuiz(options, context);
    const session = this.createRoom(quiz, options);
    this.metrics.track('game_created', { kind: session.isDemo ? 'demo' : 'ai', demoId: session.demoId || undefined, language: session.language });

    return {
      ...session.toSummary(),
      hostToken: session.hostOwnerToken,
    };
  }

  async createSuccessorSession(payload, context = {}) {
    const { sourceSessionId, hostToken, ...options } = createNextSessionSchema.parse(payload);
    const sourceSession = this.store.getSession(sourceSessionId);
    if (!sourceSession) {
      throw new UserFacingError('This game has expired. Start a new one from the home page.', { status: 404, code: 'not_found' });
    }
    if (!sourceSession.isValidHostToken(hostToken)) {
      throw new UserFacingError('Only the person who created this game can start the next one.', { status: 403, code: 'not_host' });
    }
    if (sourceSession.gameState !== 'ended') {
      throw new UserFacingError('Finish this game before starting the next one.', { status: 409, code: 'not_ended' });
    }

    const existing = sourceSession.successorSessionId ? this.store.getSession(sourceSession.successorSessionId) : null;
    if (existing) {
      this.emitSuccessorReady(sourceSession, existing);
      return { ...existing.toSummary(), hostToken: existing.hostOwnerToken, previousSessionId: sourceSession.id, reused: true };
    }

    const transferablePlayers = sourceSession.getConnectedPlayers();
    if (transferablePlayers.length === 0) {
      throw new UserFacingError('Nobody is connected to this game any more.', { status: 409, code: 'empty' });
    }

    this.assertCapacity();
    const quiz = await this.buildQuiz(options, context);

    // Re-check after the (slow) generation: a double-click may have created it already.
    const raced = sourceSession.successorSessionId ? this.store.getSession(sourceSession.successorSessionId) : null;
    if (raced) {
      return { ...raced.toSummary(), hostToken: raced.hostOwnerToken, previousSessionId: sourceSession.id, reused: true };
    }

    const successor = this.createRoom(quiz, options);
    sourceSession.successorSessionId = successor.id;

    sourceSession.getConnectedPlayers().forEach((sourcePlayer) => {
      const isOwner = sourcePlayer.playerId === sourceSession.hostOwnerPlayerId;
      const nextPlayer = successor.addPlayer({
        username: sourcePlayer.username,
        socketId: sourcePlayer.socketId,
        hostToken: isOwner ? successor.hostOwnerToken : null,
      });
      sourceSession.successorPlayerTokenMap.set(sourcePlayer.playerToken, {
        sessionId: successor.id,
        playerId: nextPlayer.playerId,
      });
      const socket = sourcePlayer.socketId ? this.io.sockets.sockets.get(sourcePlayer.socketId) : null;
      if (socket) {
        this.moveSocket(socket, sourceSession, successor, nextPlayer);
      } else {
        nextPlayer.connected = false;
        nextPlayer.socketId = null;
      }
      sourcePlayer.connected = false;
      sourcePlayer.socketId = null;
    });

    sourceSession.touch();
    this.emitSuccessorReady(sourceSession, successor);
    this.broadcastSummary(successor);
    this.metrics.track('game_created', { kind: successor.isDemo ? 'demo' : 'ai', mode: 'successor', players: successor.players.size });

    return { ...successor.toSummary(), hostToken: successor.hostOwnerToken, previousSessionId: sourceSession.id, reused: false };
  }

  moveSocket(socket, fromSession, toSession, player) {
    socket.leave(fromSession.id);
    socket.join(toSession.id);
    socket.data.sessionId = toSession.id;
    socket.data.playerId = player.playerId;
    this.store.bindSocket({ sessionId: toSession.id, playerId: player.playerId, socketId: socket.id });
  }

  emitSuccessorReady(sourceSession, successor) {
    successor.players.forEach((player) => {
      this.emitToPlayer(player, 'next-game-ready', this.buildJoinedPayload(successor, player, { previousSessionId: sourceSession.id }));
    });
  }

  // ------------------------------------------------------------- teacher mode

  getReviewSession(sessionId, hostToken) {
    const session = this.store.getSession(sessionId);
    if (!session) {
      throw new UserFacingError('This game has expired.', { status: 404, code: 'not_found' });
    }
    if (!session.isValidHostToken(hostToken)) {
      throw new UserFacingError('Only the person who created this game can review it.', { status: 403, code: 'not_host' });
    }
    if (!session.reviewMode) {
      throw new UserFacingError('This game was created as a surprise quiz, so its questions stay hidden until play.', {
        status: 403,
        code: 'surprise_mode',
      });
    }
    return session;
  }

  getQuestionsForReview(sessionId, hostToken) {
    const session = this.getReviewSession(sessionId, hostToken);
    session.hostReviewed = true;
    this.broadcastSummary(session);
    return { sessionId: session.id, gameState: session.gameState, questions: session.questions };
  }

  updateQuestionsForReview(sessionId, hostToken, payload) {
    const session = this.getReviewSession(sessionId, hostToken);
    if (session.gameState !== 'waiting') {
      throw new UserFacingError('Questions can only be edited before the game starts.', { status: 409, code: 'already_started' });
    }
    const { questions } = reviewUpdateSchema.parse(payload);
    session.questions = questions;
    session.hostReviewed = true;
    session.touch();
    this.broadcastSummary(session);
    return { sessionId: session.id, questions: session.questions };
  }

  // ---------------------------------------------------------------- payloads

  buildJoinedPayload(session, player, extras = {}) {
    return {
      session: session.toSummary(),
      playerId: player.playerId,
      playerToken: player.playerToken,
      hostToken: player.playerId === session.hostOwnerPlayerId ? session.hostOwnerToken : null,
      ...extras,
    };
  }

  buildQuestionPayload(session) {
    const question = session.questions[session.currentQuestionIndex];
    return {
      roundId: session.currentRoundId,
      questionIndex: session.currentQuestionIndex,
      questionNumber: session.currentQuestionIndex + 1,
      totalQuestions: session.questions.length,
      question: question.question,
      choices: question.choices,
      timeLimit: session.questionTimeLimitMs,
      revealTiming: session.revealTiming,
      questionStartedAt: session.currentQuestionStartedAt,
      questionEndsAt: session.currentQuestionEndsAt,
      serverTime: Date.now(),
    };
  }

  buildAnswerStats(session) {
    const stats = [0, 0, 0, 0];
    for (const player of session.players.values()) {
      const answer = player.answers[session.currentQuestionIndex];
      if (answer) stats[answer.answerIndex] += 1;
    }
    return stats;
  }

  buildResultsPayload(session) {
    const question = session.questions[session.currentQuestionIndex];
    return {
      roundId: session.currentRoundId,
      questionIndex: session.currentQuestionIndex,
      questionNumber: session.currentQuestionIndex + 1,
      totalQuestions: session.questions.length,
      questionText: question.question,
      choices: question.choices,
      correctAnswer: question.correctAnswerIndex,
      answerStats: this.buildAnswerStats(session),
      leaderboard: session.getLeaderboard(),
      isLastQuestion: session.currentQuestionIndex >= session.questions.length - 1,
    };
  }

  buildRoundResult(session, player) {
    const answer = player?.answers[session.currentQuestionIndex] || null;
    return {
      roundId: session.currentRoundId,
      answerIndex: answer ? answer.answerIndex : null,
      points: answer ? answer.points : 0,
      correct: Boolean(answer?.isCorrect),
    };
  }

  buildSnapshot(session, player) {
    const snapshot = { session: session.toSummary(), playerId: player?.playerId || null, phase: session.gameState };
    if (session.gameState === 'question') {
      snapshot.question = this.buildQuestionPayload(session);
      snapshot.yourAnswerIndex = player?.answers[session.currentQuestionIndex]?.answerIndex ?? null;
      snapshot.answeredCount = this.countAnswers(session);
    } else if (session.gameState === 'results') {
      snapshot.results = this.buildResultsPayload(session);
      snapshot.roundResult = this.buildRoundResult(session, player);
    } else if (session.gameState === 'ended') {
      snapshot.leaderboard = session.getLeaderboard();
    }
    return snapshot;
  }

  countAnswers(session) {
    let count = 0;
    for (const player of session.players.values()) {
      if (player.answers[session.currentQuestionIndex]) count += 1;
    }
    return count;
  }

  broadcastSummary(session) {
    clearTimeout(session.summaryTimer);
    session.summaryTimer = null;
    this.io.to(session.id).emit('session-updated', session.toSummary());
  }

  // Joins and drops arrive in bursts (a class scanning the QR code); coalesce them.
  broadcastSummarySoon(session) {
    if (session.summaryTimer) return;
    session.summaryTimer = setTimeout(() => {
      session.summaryTimer = null;
      if (this.store.getSession(session.id)) this.broadcastSummary(session);
    }, 150);
    session.summaryTimer.unref?.();
  }

  emitToPlayer(player, eventName, payload) {
    if (player?.socketId) {
      this.io.to(player.socketId).emit(eventName, payload);
    }
  }

  // ---------------------------------------------------------------- joining

  joinSession(socket, rawPayload) {
    const payload = joinGameSchema.parse(rawPayload);
    const clientIp = getSocketClientIp(socket, this.config.trustProxy);
    if (this.isShuttingDown) {
      throw new UserFacingError('Kazoot is restarting for an update. Please try again in a minute.', { code: 'restarting' });
    }
    if (!this.joinRateLimiter.consume(`${clientIp}:${payload.sessionId}`).allowed) {
      throw new UserFacingError('Too many join attempts. Please wait a moment and try again.', { code: 'rate_limited' });
    }

    const session = this.store.getSession(payload.sessionId);
    if (!session) {
      this.metrics.count('join_failed_not_found');
      if (!this.failedJoinRateLimiter.consume(`missing:${clientIp}`).allowed) {
        throw new UserFacingError('Too many attempts with unknown room codes. Please wait a few minutes.', { code: 'rate_limited' });
      }
      throw new UserFacingError('We couldn’t find that room. Check the code — it may also have ended or expired.', {
        code: 'room_not_found',
        status: 404,
      });
    }

    // A player from a finished game whose host started the next one follows along.
    const successorMapping = payload.playerToken ? session.successorPlayerTokenMap.get(payload.playerToken) : null;
    const successor = successorMapping ? this.store.getSession(successorMapping.sessionId) : null;
    const successorPlayer = successor?.players.get(successorMapping.playerId);
    if (successor && successorPlayer) {
      successor.reconnectPlayer(successorPlayer, socket.id);
      this.moveSocket(socket, session, successor, successorPlayer);
      const readyPayload = this.buildJoinedPayload(successor, successorPlayer, { previousSessionId: session.id, reconnected: true });
      socket.emit('next-game-ready', readyPayload);
      socket.emit('state-snapshot', this.buildSnapshot(successor, successorPlayer));
      this.broadcastSummary(successor);
      return readyPayload;
    }

    let player = payload.playerToken ? session.getPlayerByToken(payload.playerToken) : null;
    let reconnected = false;
    const hostBefore = session.getHostPlayer()?.playerId || null;

    if (player) {
      const wasOffline = session.reconnectPlayer(player, socket.id, { username: payload.username, hostToken: payload.hostToken });
      reconnected = true;
      if (wasOffline) {
        this.metrics.count('reconnects');
        socket.to(session.id).emit('player-reconnected', { playerId: player.playerId, username: player.username });
      }
    } else {
      if (session.gameState === 'ended') {
        throw new UserFacingError('This game has already finished.', { code: 'game_ended', status: 409 });
      }
      if (session.players.size >= session.maxPlayers) {
        this.metrics.count('join_failed_full');
        throw new UserFacingError(`This room is full (${session.maxPlayers} players).`, { code: 'room_full', status: 409 });
      }
      if (this.store.getHealthSnapshot().connectedPlayers >= this.config.maxConnectedPlayers) {
        throw new UserFacingError('Kazoot is very busy right now. Please try again in a few minutes.', { code: 'at_capacity', status: 503 });
      }
      player = session.addPlayer({ username: payload.username, socketId: socket.id, hostToken: payload.hostToken });
      socket.to(session.id).emit('player-joined', { playerId: player.playerId, username: player.username });
    }

    // If this socket was previously seated elsewhere, leave that room.
    if (socket.data.sessionId && socket.data.sessionId !== session.id) {
      socket.leave(socket.data.sessionId);
    }
    socket.join(session.id);
    this.store.bindSocket({ sessionId: session.id, playerId: player.playerId, socketId: socket.id });
    socket.data.sessionId = session.id;
    socket.data.playerId = player.playerId;

    const joinedPayload = this.buildJoinedPayload(session, player, { reconnected });
    socket.emit('joined-game', joinedPayload);
    socket.emit('state-snapshot', this.buildSnapshot(session, player));
    this.broadcastSummarySoon(session);
    this.announceHostChange(session, hostBefore);
    this.clearHostGraceIfOwnerBack(session);

    this.logger.info('player_joined', {
      sessionId: session.id,
      reconnected,
      gameState: session.gameState,
      players: session.players.size,
    });
    return joinedPayload;
  }

  // Lightweight resync after the tab regains focus or the network returns.
  syncState(socket) {
    const { session, player } = this.store.getBySocketId(socket.id);
    if (!session || !player) {
      return { ok: false, code: 'not_joined' };
    }
    socket.emit('state-snapshot', this.buildSnapshot(session, player));
    return { ok: true, phase: session.gameState };
  }

  leaveSession(socket) {
    const { session, player } = this.store.unbindSocket(socket.id);
    socket.data.sessionId = null;
    socket.data.playerId = null;
    if (!session || !player) {
      return { ok: true };
    }
    socket.leave(session.id);
    const hostBefore = session.getHostPlayer()?.playerId || null;
    const isOwner = player.playerId === session.hostOwnerPlayerId;
    if (session.gameState === 'waiting' && !isOwner) {
      session.removePlayer(player.playerId);
    } else {
      // Leaving on purpose: no grace period before someone else can host.
      session.markDisconnected(player.playerId, { skipGrace: true });
    }
    this.io.to(session.id).emit('player-left', { playerId: player.playerId, username: player.username });
    this.afterPlayerLost(session, hostBefore);
    return { ok: true };
  }

  handleDisconnect(socketId) {
    const { session, player } = this.store.unbindSocket(socketId);
    if (!session || !player) {
      return;
    }
    const hostBefore = session.getHostPlayer()?.playerId || null;
    session.markDisconnected(player.playerId);
    this.io.to(session.id).emit('player-left', { playerId: player.playerId, username: player.username });
    if (player.playerId === session.hostOwnerPlayerId) {
      this.scheduleHostGrace(session);
    }
    this.afterPlayerLost(session, hostBefore);
  }

  afterPlayerLost(session, hostBefore) {
    this.announceHostChange(session, hostBefore);
    if (session.gameState === 'question' && session.revealTiming === 'all_answered' && this.haveAllConnectedAnswered(session)) {
      this.finishQuestion(session.id, session.currentRoundId);
      return;
    }
    this.broadcastSummarySoon(session);
  }

  scheduleHostGrace(session) {
    clearTimeout(session.hostGraceTimer);
    if (!session.hostGraceMs) {
      return;
    }
    session.hostGraceTimer = setTimeout(() => {
      session.hostGraceTimer = null;
      if (!this.store.getSession(session.id)) return;
      const hostBefore = session.getHostPlayer()?.playerId || null;
      session.refreshHostAuthority();
      this.announceHostChange(session, hostBefore);
      this.broadcastSummary(session);
    }, session.hostGraceMs + 50);
    session.hostGraceTimer.unref?.();
  }

  clearHostGraceIfOwnerBack(session) {
    if (session.getHostStatus() === 'present') {
      clearTimeout(session.hostGraceTimer);
      session.hostGraceTimer = null;
    }
  }

  // Announces a change of who controls the game (not the owner's first arrival).
  announceHostChange(session, hostBefore) {
    const host = session.getHostPlayer();
    const firstArrival = !hostBefore && session.getRole(host) === 'owner' && !session.startedAt;
    if (host && host.playerId !== hostBefore && !firstArrival) {
      this.io.to(session.id).emit('host-changed', {
        playerId: host.playerId,
        username: host.username,
        role: session.getRole(host),
      });
    }
  }

  // ---------------------------------------------------------------- gameplay

  requireSeat(socketId) {
    const { session, player } = this.store.getBySocketId(socketId);
    if (!session || !player) {
      throw new UserFacingError('You’re not connected to a game. Rejoining…', { code: 'not_joined', status: 409 });
    }
    return { session, player };
  }

  requireHost(session, player) {
    if (!session.canControlGame(player)) {
      throw new UserFacingError(
        session.getHostStatus() === 'reconnecting'
          ? 'The host is reconnecting. They’ll be able to continue in a moment.'
          : 'Only the host can do that.',
        { code: 'not_host', status: 403 }
      );
    }
  }

  startGame(socketId) {
    const { session, player } = this.requireSeat(socketId);
    this.requireHost(session, player);
    if (session.gameState !== 'waiting') {
      return { ok: true, alreadyStarted: true };
    }
    session.startedAt = Date.now();
    this.metrics.track('game_started', { kind: session.isDemo ? 'demo' : 'ai', players: session.players.size });
    this.startQuestion(session, 0);
    return { ok: true };
  }

  startQuestion(session, questionIndex) {
    session.clearTimer();
    session.gameState = 'question';
    session.currentQuestionIndex = questionIndex;
    session.currentRoundId = `${session.id}-${questionIndex + 1}-${Date.now().toString(36)}`;
    session.currentQuestionStartedAt = Date.now();
    session.currentQuestionEndsAt = session.currentQuestionStartedAt + session.questionTimeLimitMs;
    session.touch();

    const roundId = session.currentRoundId;
    // Late answers sent just before the deadline still count (network grace).
    session.currentQuestionTimer = setTimeout(() => {
      this.finishQuestion(session.id, roundId);
    }, session.questionTimeLimitMs + this.config.answerGraceMs);
    session.currentQuestionTimer.unref?.();

    this.io.to(session.id).emit('question-start', this.buildQuestionPayload(session));
    this.broadcastSummary(session);
  }

  submitAnswer(socketId, rawPayload) {
    const payload = submitAnswerSchema.parse(rawPayload);
    const { session, player } = this.requireSeat(socketId);

    if (session.gameState !== 'question' || payload.roundId !== session.currentRoundId) {
      throw new UserFacingError('That question has already closed.', { code: 'round_closed', status: 409 });
    }

    const questionIndex = session.currentQuestionIndex;
    const existing = player.answers[questionIndex];
    if (existing) {
      // Idempotent: repeat taps and retries return the original answer.
      return { ok: true, accepted: true, alreadySubmitted: true, answerIndex: existing.answerIndex, roundId: payload.roundId };
    }

    const now = Date.now();
    if (now > session.currentQuestionEndsAt + this.config.answerGraceMs) {
      throw new UserFacingError('Time was up before your answer arrived.', { code: 'round_closed', status: 409 });
    }

    const question = session.questions[questionIndex];
    const isCorrect = payload.answerIndex === question.correctAnswerIndex;
    const earned = isCorrect ? points(session.currentQuestionEndsAt - now, session.questionTimeLimitMs) : 0;
    player.answers[questionIndex] = {
      roundId: session.currentRoundId,
      answerIndex: payload.answerIndex,
      isCorrect,
      points: earned,
      submittedAt: now,
    };
    player.score += earned;
    session.touch();

    this.scheduleAnswerProgress(session);

    if (session.revealTiming === 'all_answered' && this.haveAllConnectedAnswered(session)) {
      // Reveal after the acknowledgement has been sent.
      setImmediate(() => this.finishQuestion(session.id, payload.roundId));
    }

    return { ok: true, accepted: true, alreadySubmitted: false, answerIndex: payload.answerIndex, roundId: payload.roundId };
  }

  // Answer counts are broadcast at most every 250 ms per room: one broadcast per
  // answer would be O(players²) messages per question in big rooms.
  scheduleAnswerProgress(session) {
    if (session.answerProgressTimer) return;
    session.answerProgressTimer = setTimeout(() => {
      session.answerProgressTimer = null;
      if (session.gameState !== 'question') return;
      this.io.to(session.id).emit('answer-progress', {
        roundId: session.currentRoundId,
        answeredCount: this.countAnswers(session),
        connectedCount: session.getConnectedPlayers().length,
      });
    }, 250);
    session.answerProgressTimer.unref?.();
  }

  haveAllConnectedAnswered(session) {
    const connected = session.getConnectedPlayers();
    return connected.length > 0 && connected.every((player) => Boolean(player.answers[session.currentQuestionIndex]));
  }

  finishQuestion(sessionId, expectedRoundId) {
    const session = this.store.getSession(sessionId);
    if (!session || session.gameState !== 'question' || session.currentRoundId !== expectedRoundId) {
      return;
    }

    session.clearTimer();
    session.gameState = 'results';
    session.touch();

    this.io.to(session.id).emit('question-results', this.buildResultsPayload(session));
    session.players.forEach((player) => {
      this.emitToPlayer(player, 'round-result', this.buildRoundResult(session, player));
    });
    this.broadcastSummary(session);
  }

  advance(socketId, rawPayload) {
    const { fromQuestionIndex } = advanceSchema.parse(rawPayload || {});
    const { session, player } = this.requireSeat(socketId);
    this.requireHost(session, player);

    if (typeof fromQuestionIndex === 'number' && fromQuestionIndex !== session.currentQuestionIndex) {
      // A delayed or repeated click from an earlier screen: ignore it.
      return { ok: true, stale: true };
    }
    if (session.gameState !== 'results') {
      return { ok: true, stale: true };
    }

    if (session.currentQuestionIndex >= session.questions.length - 1) {
      this.endGame(session);
      return { ok: true, ended: true };
    }

    this.startQuestion(session, session.currentQuestionIndex + 1);
    return { ok: true };
  }

  endGame(session) {
    session.clearTimer();
    session.gameState = 'ended';
    session.endedAt = Date.now();
    session.touch();
    this.io.to(session.id).emit('game-end', { leaderboard: session.getLeaderboard() });
    this.broadcastSummary(session);
    this.metrics.track('game_completed', {
      kind: session.isDemo ? 'demo' : 'ai',
      players: session.players.size,
      questions: session.questions.length,
    });
  }

  // --------------------------------------------------------------- lifecycle

  notifyShutdown() {
    this.isShuttingDown = true;
    this.io.emit('server-restarting', {
      message: 'Kazoot is restarting for an update. Games in progress can’t continue — sorry! Please start a new game in a minute.',
    });
  }

  wrapSocketHandler(socket, handler) {
    return async (payload, ack) => {
      if (typeof payload === 'function') {
        ack = payload;
        payload = {};
      }
      const reply = typeof ack === 'function' ? ack : null;
      try {
        const clientIp = getSocketClientIp(socket, this.config.trustProxy);
        if (!this.socketEventRateLimiter.consume(`${clientIp}:${socket.id}`).allowed) {
          throw new UserFacingError('Too many actions. Please slow down.', { code: 'rate_limited', status: 429 });
        }
        const result = await handler(payload || {});
        reply?.({ ok: true, ...(result || {}) });
      } catch (error) {
        const clientError = toClientError(error);
        if (clientError.status >= 500) {
          this.logger.error('socket_handler_failed', { message: error.message, stack: error.stack });
        }
        if (reply) {
          reply({ ok: false, code: clientError.code, message: clientError.message });
        } else {
          socket.emit('action-error', { code: clientError.code, message: clientError.message });
        }
      }
    };
  }
}

module.exports = {
  GameService,
  getSocketClientIp,
  points,
};
