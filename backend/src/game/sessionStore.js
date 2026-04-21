const { v4: uuidv4 } = require('uuid');

function generateSessionId() {
  return uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase();
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
      connected: player.connected,
    }));
}

class GameSession {
  constructor({ id, topic, language, questions, questionSource, questionTimeLimitMs }) {
    this.id = id;
    this.topic = topic;
    this.language = language;
    this.questions = questions;
    this.questionSource = questionSource;
    this.questionTimeLimitMs = questionTimeLimitMs;
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

  addPlayer({ username, socketId, wantsHost = false }) {
    const playerId = uuidv4();
    const playerToken = uuidv4();
    const existingHost = this.getHost();
    const joinedAt = Date.now();

    const player = {
      playerId,
      playerToken,
      username: username.trim(),
      score: 0,
      isHost: wantsHost ? !existingHost : !existingHost,
      connected: true,
      socketId,
      joinedAt,
      answers: {},
    };

    this.players.set(playerId, player);
    this.lastConnectedAt = Date.now();
    this.touch();
    return player;
  }

  reconnectPlayer(player, socketId, username) {
    player.connected = true;
    player.socketId = socketId;
    player.username = username?.trim() || player.username;
    if (!this.getHost()) {
      player.isHost = true;
    }
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

    if (player.isHost) {
      player.isHost = false;
      const replacement = this.getConnectedPlayers()[0] || null;
      if (replacement) {
        replacement.isHost = true;
      }
    }

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
        connected: player.connected,
      })),
      leaderboard,
      you: currentPlayer
        ? {
            playerId: currentPlayer.playerId,
            username: currentPlayer.username,
            score: currentPlayer.score,
            isHost: currentPlayer.isHost,
            connected: currentPlayer.connected,
          }
        : null,
    };
  }
}

class SessionStore {
  constructor({ sessionRetentionMs, endedSessionRetentionMs }) {
    this.sessions = new Map();
    this.socketIndex = new Map();
    this.sessionRetentionMs = sessionRetentionMs;
    this.endedSessionRetentionMs = endedSessionRetentionMs;
  }

  createSession({ topic, language, questions, questionSource, questionTimeLimitMs }) {
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
    });

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  bindSocket({ sessionId, playerId, socketId }) {
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
    return { session, player };
  }

  deleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.clearTimer();
    [...session.players.values()].forEach((player) => {
      if (player.socketId) {
        this.socketIndex.delete(player.socketId);
      }
    });

    this.sessions.delete(sessionId);
  }

  reapExpiredSessions() {
    const now = Date.now();

    for (const [sessionId, session] of this.sessions.entries()) {
      const idleFor = now - session.updatedAt;
      const hasConnectedPlayers = session.getConnectedPlayers().length > 0;

      if (session.gameState === 'ended' && idleFor > this.endedSessionRetentionMs) {
        this.deleteSession(sessionId);
        continue;
      }

      if (!hasConnectedPlayers && idleFor > this.sessionRetentionMs) {
        this.deleteSession(sessionId);
      }
    }
  }
}

module.exports = {
  SessionStore,
};
