const { randomUUID } = require('crypto');

const SESSION_ID_LENGTH = 10;
const SESSION_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateSessionId() {
  const bytes = Buffer.from(randomUUID().replace(/-/g, ''), 'hex');
  let code = '';
  for (let index = 0; index < SESSION_ID_LENGTH; index += 1) {
    code += SESSION_ID_ALPHABET[bytes[index] % SESSION_ID_ALPHABET.length];
  }
  return code;
}

function sortLeaderboard(players) {
  return [...players]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.joinedAt - right.joinedAt;
    })
    .map((player, index) => ({
      rank: index + 1,
      playerId: player.playerId,
      username: player.username,
      score: player.score,
      isHost: player.isHost,
      isTemporaryHost: player.isTemporaryHost,
      hostAuthority: player.hostAuthority,
      connected: player.connected,
    }));
}

class GameSession {
  constructor({ id, topic, language, questions, questionSource, questionTimeLimitMs, revealTiming }) {
    this.id = id;
    this.topic = topic;
    this.language = language;
    this.questions = questions;
    this.questionSource = questionSource;
    this.questionTimeLimitMs = questionTimeLimitMs;
    this.revealTiming = revealTiming;
    this.players = new Map();
    this.gameState = 'waiting';
    this.currentQuestionIndex = -1;
    this.currentRoundId = null;
    this.currentQuestionStartedAt = null;
    this.currentQuestionEndsAt = null;
    this.currentQuestionTimer = null;
    this.lastResults = null;
    this.createdAt = Date.now();
    this.updatedAt = this.createdAt;
    this.lastConnectedAt = this.createdAt;
    this.endedAt = null;
    this.hostOwnerToken = randomUUID();
    this.hostOwnerPlayerId = null;
    this.temporaryHostPlayerId = null;
  }

  touch() {
    this.updatedAt = Date.now();
  }

  clearTimer() {
    if (this.currentQuestionTimer) {
      clearTimeout(this.currentQuestionTimer);
      this.currentQuestionTimer = null;
    }
  }

  getConnectedPlayers() {
    return [...this.players.values()].filter((player) => player.connected);
  }

  getHost() {
    return [...this.players.values()].find((player) => player.isHost) || null;
  }

  isValidHostToken(hostToken) {
    return typeof hostToken === 'string' && hostToken === this.hostOwnerToken;
  }

  getHostAuthority(player) {
    if (!player) {
      return 'none';
    }

    if (player.playerId === this.hostOwnerPlayerId) {
      return 'owner';
    }

    if (player.playerId === this.temporaryHostPlayerId) {
      return 'temporary';
    }

    return 'none';
  }

  canControlGame(player) {
    return Boolean(player?.connected && ['owner', 'temporary'].includes(this.getHostAuthority(player)));
  }

  getEligibleTemporaryHost() {
    return this.getConnectedPlayers()
      .filter((player) => player.playerId !== this.hostOwnerPlayerId)
      .sort((left, right) => left.joinedAt - right.joinedAt)[0] || null;
  }

  refreshHostAuthority({ preserveTemporaryHost = true } = {}) {
    const owner = this.hostOwnerPlayerId ? this.players.get(this.hostOwnerPlayerId) : null;

    if (owner?.connected) {
      this.temporaryHostPlayerId = null;
    } else if (!this.hostOwnerPlayerId) {
      this.temporaryHostPlayerId = null;
    } else {
      const currentTemporaryHost = this.temporaryHostPlayerId
        ? this.players.get(this.temporaryHostPlayerId)
        : null;
      const canKeepTemporaryHost =
        preserveTemporaryHost &&
        currentTemporaryHost?.connected &&
        currentTemporaryHost.playerId !== this.hostOwnerPlayerId;

      if (!canKeepTemporaryHost) {
        this.temporaryHostPlayerId = this.getEligibleTemporaryHost()?.playerId || null;
      }
    }

    this.players.forEach((player) => {
      const hostAuthority = this.getHostAuthority(player);
      player.hostAuthority = hostAuthority;
      player.isTemporaryHost = hostAuthority === 'temporary';
      player.isHost = player.connected && (hostAuthority === 'owner' || hostAuthority === 'temporary');
    });
  }

  getPlayerByToken(playerToken) {
    return [...this.players.values()].find((player) => player.playerToken === playerToken) || null;
  }

  getPlayerBySocketId(socketId) {
    return [...this.players.values()].find((player) => player.socketId === socketId) || null;
  }

  hasUsernameConflict(username, playerIdToIgnore = null) {
    const normalized = username.trim().toLowerCase();
    return [...this.players.values()].some((player) => {
      if (player.playerId === playerIdToIgnore) {
        return false;
      }

      return player.username.trim().toLowerCase() === normalized;
    });
  }

  addPlayer({ username, socketId, hostToken = null }) {
    const playerId = randomUUID();
    const playerToken = randomUUID();
    const isOwnerHost = this.isValidHostToken(hostToken);
    const joinedAt = Date.now();

    const player = {
      playerId,
      playerToken,
      username: username.trim(),
      score: 0,
      isHost: false,
      isTemporaryHost: false,
      hostAuthority: 'none',
      hostToken: isOwnerHost ? this.hostOwnerToken : null,
      connected: true,
      socketId,
      joinedAt,
      answers: {},
    };

    this.players.set(playerId, player);
    if (isOwnerHost) {
      this.hostOwnerPlayerId = playerId;
    }
    this.refreshHostAuthority({ preserveTemporaryHost: false });
    this.lastConnectedAt = Date.now();
    this.touch();
    return player;
  }

  reconnectPlayer(player, socketId, username, { hostToken = null } = {}) {
    player.connected = true;
    player.socketId = socketId;
    player.username = username?.trim() || player.username;

    if (this.isValidHostToken(hostToken) || player.hostToken === this.hostOwnerToken) {
      player.hostToken = this.hostOwnerToken;
      this.hostOwnerPlayerId = player.playerId;
    }

    this.refreshHostAuthority({ preserveTemporaryHost: false });
    this.lastConnectedAt = Date.now();
    this.touch();
    return player;
  }

  markDisconnected(playerId) {
    const player = this.players.get(playerId);
    if (!player) {
      return null;
    }

    player.connected = false;
    player.socketId = null;

    this.refreshHostAuthority({ preserveTemporaryHost: false });

    this.touch();
    return player;
  }

  toSessionSummary(playerId = null) {
    const leaderboard = sortLeaderboard(this.players.values());
    const currentPlayer = playerId ? this.players.get(playerId) : null;

    return {
      sessionId: this.id,
      topic: this.topic,
      language: this.language,
      questionCount: this.questions.length,
      questionTimeLimitMs: this.questionTimeLimitMs,
      revealTiming: this.revealTiming,
      questionSource: this.questionSource,
      playerCount: this.players.size,
      connectedPlayerCount: this.getConnectedPlayers().length,
      gameState: this.gameState,
      currentQuestionIndex: this.currentQuestionIndex,
      currentRoundId: this.currentRoundId,
      currentQuestionEndsAt: this.currentQuestionEndsAt,
      players: [...this.players.values()].map((player) => ({
        playerId: player.playerId,
        username: player.username,
        score: player.score,
        isHost: player.isHost,
        isTemporaryHost: player.isTemporaryHost,
        hostAuthority: player.hostAuthority,
        connected: player.connected,
      })),
      leaderboard,
      you: currentPlayer
        ? {
            playerId: currentPlayer.playerId,
            username: currentPlayer.username,
            score: currentPlayer.score,
            isHost: currentPlayer.isHost,
            isTemporaryHost: currentPlayer.isTemporaryHost,
            hostAuthority: currentPlayer.hostAuthority,
            connected: currentPlayer.connected,
          }
        : null,
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
    if (typeof this.logger !== 'function') {
      return;
    }

    this.logger(eventName, details);
  }

  getStoreMode() {
    return this.storeMode;
  }

  getSocketIndexSize() {
    return this.socketIndex.size;
  }

  getKnownSessionIds() {
    return [...this.sessions.keys()];
  }

  getStateCounts() {
    return [...this.sessions.values()].reduce((counts, session) => {
      counts[session.gameState] = (counts[session.gameState] || 0) + 1;
      return counts;
    }, {});
  }

  getHealthSnapshot() {
    return {
      storeMode: this.storeMode,
      activeSessions: this.sessions.size,
      socketIndexSize: this.socketIndex.size,
      sessionsByState: this.getStateCounts(),
      totalPlayers: [...this.sessions.values()].reduce((total, session) => total + session.players.size, 0),
      connectedPlayers: [...this.sessions.values()].reduce(
        (total, session) => total + session.getConnectedPlayers().length,
        0
      ),
    };
  }

  getSessionDiagnostics() {
    return [...this.sessions.values()].map((session) => ({
      sessionId: session.id,
      topic: session.topic,
      gameState: session.gameState,
      questionCount: session.questions.length,
      currentQuestionIndex: session.currentQuestionIndex,
      currentRoundId: session.currentRoundId,
      questionTimeLimitMs: session.questionTimeLimitMs,
      revealTiming: session.revealTiming,
      playerCount: session.players.size,
      connectedPlayerCount: session.getConnectedPlayers().length,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      endedAt: session.endedAt,
    }));
  }

  auditIntegrity() {
    const issues = [];

    for (const [socketId, indexed] of this.socketIndex.entries()) {
      const session = this.sessions.get(indexed.sessionId);
      if (!session) {
        issues.push({
          type: 'missing_session',
          socketId,
          sessionId: indexed.sessionId,
          playerId: indexed.playerId,
        });
        continue;
      }

      const player = session.players.get(indexed.playerId);
      if (!player) {
        issues.push({
          type: 'missing_player',
          socketId,
          sessionId: indexed.sessionId,
          playerId: indexed.playerId,
        });
        continue;
      }

      if (player.socketId !== socketId) {
        issues.push({
          type: 'stale_socket_binding',
          socketId,
          sessionId: indexed.sessionId,
          playerId: indexed.playerId,
          playerSocketId: player.socketId,
        });
      }
    }

    return issues;
  }

  pruneSocketIndex({ sessionId = null, dropSessionEntries = false, reason = 'manual' } = {}) {
    const removed = [];

    for (const [socketId, indexed] of this.socketIndex.entries()) {
      const session = this.sessions.get(indexed.sessionId);
      const player = session?.players.get(indexed.playerId) || null;
      const shouldRemove =
        (dropSessionEntries && sessionId && indexed.sessionId === sessionId) ||
        !session ||
        !player ||
        player.socketId !== socketId;

      if (shouldRemove) {
        this.socketIndex.delete(socketId);
        removed.push({
          socketId,
          sessionId: indexed.sessionId,
          playerId: indexed.playerId,
        });
      }
    }

    if (removed.length > 0) {
      this.log('socket_index_pruned', {
        reason,
        removed,
        socketIndexSize: this.socketIndex.size,
      });
    }

    return removed;
  }

  createSession({ topic, language, questions, questionSource, questionTimeLimitMs, revealTiming }) {
    let sessionId = generateSessionId();

    while (this.sessions.has(sessionId)) {
      sessionId = generateSessionId();
    }

    const session = new GameSession({
      id: sessionId,
      topic,
      language,
      questions,
      questionSource,
      questionTimeLimitMs,
      revealTiming,
    });

    this.sessions.set(sessionId, session);
    this.log('session_created', {
      sessionId: session.id,
      topic: session.topic,
      questionCount: session.questions.length,
      questionTimeLimitMs: session.questionTimeLimitMs,
      revealTiming: session.revealTiming,
      activeSessions: this.sessions.size,
    });
    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  bindSocket({ sessionId, playerId, socketId }) {
    this.pruneSocketIndex({ sessionId, reason: 'bind_socket' });
    this.socketIndex.set(socketId, { sessionId, playerId });
    const session = this.getSession(sessionId);
    if (!session) {
      return;
    }

    const player = session.players.get(playerId);
    if (player?.socketId && player.socketId !== socketId) {
      this.socketIndex.delete(player.socketId);
    }
    if (player) {
      player.socketId = socketId;
      player.connected = true;
    }
  }

  getBySocketId(socketId) {
    const indexed = this.socketIndex.get(socketId);
    if (!indexed) {
      return { session: null, player: null };
    }

    const session = this.getSession(indexed.sessionId);
    const player = session?.players.get(indexed.playerId) || null;
    return { session, player };
  }

  unbindSocket(socketId) {
    const indexed = this.socketIndex.get(socketId);
    this.socketIndex.delete(socketId);
    if (!indexed) {
      return { session: null, player: null };
    }

    const session = this.getSession(indexed.sessionId);
    const player = session?.players.get(indexed.playerId) || null;
    this.pruneSocketIndex({ reason: 'unbind_socket' });
    return { session, player };
  }

  deleteSession(sessionId, { reason = 'manual' } = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.clearTimer();
    this.pruneSocketIndex({ sessionId, dropSessionEntries: true, reason: `delete_session:${reason}` });
    this.sessions.delete(sessionId);
    this.log('session_deleted', {
      sessionId,
      reason,
      activeSessions: this.sessions.size,
    });
  }

  reapExpiredSessions() {
    const now = Date.now();
    this.pruneSocketIndex({ reason: 'reap_expired_sessions' });

    for (const [sessionId, session] of this.sessions.entries()) {
      const idleFor = now - session.updatedAt;
      const hasConnectedPlayers = session.getConnectedPlayers().length > 0;

      if (session.gameState === 'ended' && idleFor > this.endedSessionRetentionMs) {
        this.deleteSession(sessionId, { reason: 'ended_retention_expired' });
        continue;
      }

      if (!hasConnectedPlayers && idleFor > this.sessionRetentionMs) {
        this.deleteSession(sessionId, { reason: 'inactive_retention_expired' });
      }
    }
  }
}

module.exports = {
  SessionStore,
};
