const { randomUUID, randomInt } = require('crypto');

// All room state lives in this process. Production runs exactly one replica
// (see DEPLOYMENT.md); a restart ends live games, and clients are told so.

const SESSION_ID_LENGTH = 10;
const SESSION_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateSessionId() {
  let code = '';
  for (let index = 0; index < SESSION_ID_LENGTH; index += 1) {
    code += SESSION_ID_ALPHABET[randomInt(SESSION_ID_ALPHABET.length)];
  }
  return code;
}

function buildLeaderboard(players, totalQuestions) {
  return [...players]
    .sort((left, right) => right.score - left.score || left.joinedAt - right.joinedAt)
    .map((player, index) => {
      const answers = Object.values(player.answers);
      return {
        rank: index + 1,
        playerId: player.playerId,
        username: player.username,
        score: player.score,
        answeredCount: answers.length,
        correctAnswerCount: answers.filter((answer) => answer.isCorrect).length,
        totalQuestions,
        connected: player.connected,
      };
    });
}

class GameSession {
  constructor({ id, topic, language, questions, questionSource, questionTimeLimitMs, revealTiming, isDemo = false, demoId = null, reviewMode = false, maxPlayers, hostGraceMs = 0 }) {
    this.id = id;
    this.topic = topic;
    this.language = language;
    this.questions = questions;
    this.questionSource = questionSource;
    this.questionTimeLimitMs = questionTimeLimitMs;
    this.revealTiming = revealTiming;
    this.isDemo = isDemo;
    this.demoId = demoId;
    this.reviewMode = reviewMode;
    this.hostReviewed = false;
    this.maxPlayers = maxPlayers;
    this.hostGraceMs = hostGraceMs;
    this.players = new Map();
    this.gameState = 'waiting';
    this.currentQuestionIndex = -1;
    this.currentRoundId = null;
    this.currentQuestionStartedAt = null;
    this.currentQuestionEndsAt = null;
    this.currentQuestionTimer = null;
    this.hostGraceTimer = null;
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
    this.startedAt = null;
    this.endedAt = null;
    this.hostOwnerToken = randomUUID();
    this.hostOwnerPlayerId = null;
    this.ownerDisconnectedAt = null;
    this.temporaryHostPlayerId = null;
    this.successorSessionId = null;
    this.successorPlayerTokenMap = new Map();
  }

  touch() {
    this.updatedAt = Date.now();
  }

  clearTimer() {
    clearTimeout(this.currentQuestionTimer);
    this.currentQuestionTimer = null;
  }

  clearAllTimers() {
    this.clearTimer();
    clearTimeout(this.hostGraceTimer);
    this.hostGraceTimer = null;
    clearTimeout(this.answerProgressTimer);
    this.answerProgressTimer = null;
    clearTimeout(this.summaryTimer);
    this.summaryTimer = null;
  }

  getConnectedPlayers() {
    return [...this.players.values()].filter((player) => player.connected);
  }

  isValidHostToken(hostToken) {
    return typeof hostToken === 'string' && hostToken === this.hostOwnerToken;
  }

  getOwner() {
    return this.hostOwnerPlayerId ? this.players.get(this.hostOwnerPlayerId) || null : null;
  }

  // 'present' | 'reconnecting' (within the grace period) | 'away' | 'none' (owner never joined)
  getHostStatus(now = Date.now()) {
    const owner = this.getOwner();
    if (!owner) return 'none';
    if (owner.connected) return 'present';
    if (this.ownerDisconnectedAt && now - this.ownerDisconnectedAt < this.hostGraceMs) return 'reconnecting';
    return 'away';
  }

  getRole(player) {
    if (!player) return 'none';
    if (player.playerId === this.hostOwnerPlayerId) return 'owner';
    if (player.playerId === this.temporaryHostPlayerId) return 'temporary';
    return 'player';
  }

  canControlGame(player) {
    if (!player?.connected) return false;
    const role = this.getRole(player);
    return role === 'owner' || role === 'temporary';
  }

  // The owner always controls when connected. If they have been gone longer than
  // the grace period, the longest-connected player can keep the game moving until
  // they return. A room with no owner (guest joined via link first) has no host
  // until the owner arrives.
  refreshHostAuthority() {
    const hostStatus = this.getHostStatus();
    if (hostStatus !== 'away') {
      this.temporaryHostPlayerId = null;
      return;
    }

    const current = this.temporaryHostPlayerId ? this.players.get(this.temporaryHostPlayerId) : null;
    if (current?.connected) {
      return;
    }

    const candidate = this.getConnectedPlayers()
      .filter((player) => player.playerId !== this.hostOwnerPlayerId)
      .sort((left, right) => left.joinedAt - right.joinedAt)[0];
    this.temporaryHostPlayerId = candidate?.playerId || null;
  }

  getHostPlayer() {
    const owner = this.getOwner();
    if (owner?.connected) return owner;
    return this.temporaryHostPlayerId ? this.players.get(this.temporaryHostPlayerId) || null : null;
  }

  getPlayerByToken(playerToken) {
    return [...this.players.values()].find((player) => player.playerToken === playerToken) || null;
  }

  addPlayer({ username, socketId, hostToken = null }) {
    const player = {
      playerId: randomUUID(),
      playerToken: randomUUID(),
      username,
      score: 0,
      connected: true,
      socketId,
      joinedAt: Date.now(),
      answers: {},
    };

    this.players.set(player.playerId, player);
    if (this.isValidHostToken(hostToken)) {
      this.hostOwnerPlayerId = player.playerId;
      this.ownerDisconnectedAt = null;
    }
    this.refreshHostAuthority();
    this.touch();
    return player;
  }

  // Returns true if the player had been offline (a real reconnect, worth announcing).
  reconnectPlayer(player, socketId, { username = null, hostToken = null } = {}) {
    const wasOffline = !player.connected;
    player.connected = true;
    player.socketId = socketId;
    if (username && this.gameState === 'waiting') {
      player.username = username;
    }
    if (this.isValidHostToken(hostToken)) {
      this.hostOwnerPlayerId = player.playerId;
    }
    if (player.playerId === this.hostOwnerPlayerId) {
      this.ownerDisconnectedAt = null;
    }
    this.refreshHostAuthority();
    this.touch();
    return wasOffline;
  }

  markDisconnected(playerId, { skipGrace = false } = {}) {
    const player = this.players.get(playerId);
    if (!player) return null;

    player.connected = false;
    player.socketId = null;
    if (playerId === this.hostOwnerPlayerId) {
      this.ownerDisconnectedAt = skipGrace ? Date.now() - this.hostGraceMs : Date.now();
    }
    this.refreshHostAuthority();
    this.touch();
    return player;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    if (this.temporaryHostPlayerId === playerId) {
      this.temporaryHostPlayerId = null;
    }
    this.refreshHostAuthority();
    this.touch();
  }

  getLeaderboard() {
    return buildLeaderboard(this.players.values(), this.questions.length);
  }

  // Shared, room-wide state. Contains no answers and no tokens.
  toSummary() {
    const hostPlayer = this.getHostPlayer();
    return {
      sessionId: this.id,
      topic: this.topic,
      language: this.language,
      questionCount: this.questions.length,
      questionTimeLimitMs: this.questionTimeLimitMs,
      revealTiming: this.revealTiming,
      questionSource: this.questionSource,
      isDemo: this.isDemo,
      demoId: this.demoId,
      reviewMode: this.reviewMode,
      hostReviewed: this.hostReviewed,
      maxPlayers: this.maxPlayers,
      gameState: this.gameState,
      currentQuestionIndex: this.currentQuestionIndex,
      currentRoundId: this.currentRoundId,
      hostStatus: this.getHostStatus(),
      hostPlayerId: hostPlayer?.playerId || null,
      connectedPlayerCount: this.getConnectedPlayers().length,
      players: [...this.players.values()]
        .sort((left, right) => left.joinedAt - right.joinedAt)
        .map((player) => ({
          playerId: player.playerId,
          username: player.username,
          score: player.score,
          connected: player.connected,
          role: this.getRole(player),
        })),
    };
  }
}

class SessionStore {
  constructor({ sessionRetentionMs, endedSessionRetentionMs, storeMode = 'single-instance-memory', logger = null }) {
    this.sessions = new Map();
    this.socketIndex = new Map();
    this.sessionRetentionMs = sessionRetentionMs;
    this.endedSessionRetentionMs = endedSessionRetentionMs;
    this.storeMode = storeMode;
    this.logger = logger;
  }

  log(eventName, details = {}) {
    this.logger?.(eventName, details);
  }

  getStoreMode() {
    return this.storeMode;
  }

  getSocketIndexSize() {
    return this.socketIndex.size;
  }

  getHealthSnapshot() {
    let totalPlayers = 0;
    let connectedPlayers = 0;
    const sessionsByState = {};
    for (const session of this.sessions.values()) {
      sessionsByState[session.gameState] = (sessionsByState[session.gameState] || 0) + 1;
      totalPlayers += session.players.size;
      connectedPlayers += session.getConnectedPlayers().length;
    }
    return {
      storeMode: this.storeMode,
      activeSessions: this.sessions.size,
      socketIndexSize: this.socketIndex.size,
      sessionsByState,
      totalPlayers,
      connectedPlayers,
    };
  }

  getSessionDiagnostics() {
    return [...this.sessions.values()].map((session) => ({
      sessionId: session.id,
      gameState: session.gameState,
      isDemo: session.isDemo,
      questionCount: session.questions.length,
      currentQuestionIndex: session.currentQuestionIndex,
      playerCount: session.players.size,
      connectedPlayerCount: session.getConnectedPlayers().length,
      hostStatus: session.getHostStatus(),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));
  }

  auditIntegrity() {
    const issues = [];
    for (const [socketId, indexed] of this.socketIndex.entries()) {
      const session = this.sessions.get(indexed.sessionId);
      const player = session?.players.get(indexed.playerId);
      if (!session) issues.push({ type: 'missing_session', socketId });
      else if (!player) issues.push({ type: 'missing_player', socketId });
      else if (player.socketId !== socketId) issues.push({ type: 'stale_socket_binding', socketId });
    }
    return issues;
  }

  createSession(options) {
    let sessionId = generateSessionId();
    while (this.sessions.has(sessionId)) {
      sessionId = generateSessionId();
    }

    const session = new GameSession({ id: sessionId, ...options });
    this.sessions.set(sessionId, session);
    this.log('session_created', {
      sessionId,
      isDemo: session.isDemo,
      source: session.questionSource,
      activeSessions: this.sessions.size,
    });
    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  bindSocket({ sessionId, playerId, socketId }) {
    const previous = this.socketIndex.get(socketId);
    if (previous && (previous.sessionId !== sessionId || previous.playerId !== playerId)) {
      // The socket switched seats: the old seat is no longer connected through it.
      const oldPlayer = this.getSession(previous.sessionId)?.players.get(previous.playerId);
      if (oldPlayer?.socketId === socketId) {
        oldPlayer.socketId = null;
        oldPlayer.connected = false;
      }
    }

    const session = this.getSession(sessionId);
    const player = session?.players.get(playerId);
    if (player?.socketId && player.socketId !== socketId) {
      // Same seat opened in a new tab/socket: the newest one wins.
      this.socketIndex.delete(player.socketId);
    }
    this.socketIndex.set(socketId, { sessionId, playerId });
    if (player) {
      player.socketId = socketId;
      player.connected = true;
    }
  }

  getBySocketId(socketId) {
    const indexed = this.socketIndex.get(socketId);
    const session = indexed ? this.getSession(indexed.sessionId) : null;
    const player = session?.players.get(indexed.playerId) || null;
    if (player && player.socketId !== socketId) {
      return { session, player: null };
    }
    return { session, player };
  }

  unbindSocket(socketId) {
    const result = this.getBySocketId(socketId);
    this.socketIndex.delete(socketId);
    return result;
  }

  deleteSession(sessionId, { reason = 'manual' } = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.clearAllTimers();
    for (const [socketId, indexed] of this.socketIndex.entries()) {
      if (indexed.sessionId === sessionId) {
        this.socketIndex.delete(socketId);
      }
    }
    this.sessions.delete(sessionId);
    this.log('session_deleted', { sessionId, reason, activeSessions: this.sessions.size });
  }

  reapExpiredSessions(now = Date.now()) {
    for (const [sessionId, session] of this.sessions.entries()) {
      const idleFor = now - session.updatedAt;
      const hasConnectedPlayers = session.getConnectedPlayers().length > 0;
      const retention = session.isDemo ? Math.min(this.sessionRetentionMs, 15 * 60_000) : this.sessionRetentionMs;

      if (session.gameState === 'ended' && idleFor > this.endedSessionRetentionMs) {
        this.deleteSession(sessionId, { reason: 'ended_retention_expired' });
      } else if (!hasConnectedPlayers && idleFor > retention) {
        this.deleteSession(sessionId, { reason: 'inactive_retention_expired' });
      } else if (now - session.createdAt > 6 * 60 * 60_000) {
        // Hard cap: nobody plays a 10-question quiz for six hours.
        this.deleteSession(sessionId, { reason: 'max_age' });
      }
    }
  }
}

module.exports = {
  GameSession,
  SessionStore,
  generateSessionId,
};
