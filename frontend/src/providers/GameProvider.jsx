import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getBackendUrl } from '../lib/api';
import { clearPlayerSession, loadPlayerSession, markPlayerSessionEnded, savePlayerSession } from '../lib/storage';

const GameContext = createContext(null);

export function getSocketTransports() {
  return ['polling', 'websocket'];
}

function logSocketEvent(eventName, details = {}) {
  if (!import.meta.env.PROD) {
    return;
  }

  console.log(`[socket:${eventName}]`, details);
}

function normalizeQuestionPayload(payload) {
  if (!payload) {
    return null;
  }

  const normalizedPayload = {
    ...payload,
  };

  return {
    ...normalizedPayload,
    clientReceivedAt:
      typeof normalizedPayload.clientReceivedAt === 'number'
        ? normalizedPayload.clientReceivedAt
        : Date.now(),
    submittedAnswerIndex:
      typeof normalizedPayload.submittedAnswerIndex === 'number'
        ? normalizedPayload.submittedAnswerIndex
        : null,
    pendingAnswerIndex:
      typeof normalizedPayload.pendingAnswerIndex === 'number'
        ? normalizedPayload.pendingAnswerIndex
        : null,
  };
}

export function GameProvider({ children }) {
  const socketRef = useRef(null);
  const questionRef = useRef(null);
  const sessionRef = useRef(null);
  const connectionStatusRef = useRef('disconnected');
  const notificationTimerRef = useRef(null);
  const joinIntentRef = useRef(null);
  const awaitingJoinRef = useRef(false);
  const [session, setSession] = useState(null);
  const [question, setQuestion] = useState(null);
  const [results, setResults] = useState(null);
  const [gameEnd, setGameEnd] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  useEffect(() => {
    questionRef.current = question;
  }, [question]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  const showNotice = useCallback((message) => {
    if (!message) {
      return;
    }

    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }

    setNotice(message);
    notificationTimerRef.current = setTimeout(() => {
      setNotice('');
    }, 2800);
  }, []);

  const emitJoinGame = useCallback((socket, { sessionId, username, isCreator = false, forceFresh = false }) => {
    if (!sessionId || !username) {
      return;
    }

    const saved = forceFresh ? null : loadPlayerSession(sessionId, { username });
    awaitingJoinRef.current = true;
    joinIntentRef.current = {
      sessionId,
      username,
      isCreator,
      forceFresh,
    };

    socket.emit('join-game', {
      sessionId,
      username,
      isCreator,
      playerToken: saved?.playerToken,
      hostToken: saved?.hostToken,
    });
  }, []);

  useEffect(() => {
    const socket = io(getBackendUrl(), {
      autoConnect: false,
      transports: getSocketTransports(),
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      logSocketEvent('connect', {
        socketId: socket.id,
        recovered: socket.recovered,
        transport: socket.io.engine.transport.name,
      });

      if (socket.recovered) {
        awaitingJoinRef.current = false;
        showNotice('Connection restored.');
        return;
      }

      const activeSession = sessionRef.current;
      if (activeSession && !awaitingJoinRef.current) {
        emitJoinGame(socket, {
          sessionId: activeSession.sessionId,
          username: activeSession.you?.username,
          isCreator: Boolean(activeSession.you?.isHost),
        });
      }
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      logSocketEvent('disconnect', {
        socketId: socket.id,
        transport: socket.io.engine?.transport?.name,
      });
    });

    socket.on('connect_error', (connectError) => {
      awaitingJoinRef.current = false;
      setConnectionStatus('disconnected');
      logSocketEvent('connect_error', {
        message: connectError?.message,
        description: connectError?.description,
        context: connectError?.context,
      });
    });

    socket.on('joined-game', (payload) => {
      awaitingJoinRef.current = false;
      joinIntentRef.current = {
        sessionId: payload.sessionId,
        username: payload.you?.username || payload.username,
        isCreator: Boolean(payload.you?.isHost),
        forceFresh: false,
      };
      setSession(payload);
      setQuestion(null);
      setResults(null);
      setGameEnd(null);
      savePlayerSession(payload.sessionId, {
        playerToken: payload.playerToken,
        hostToken: payload.hostToken,
        playerId: payload.playerId,
        username: payload.you?.username || payload.username,
      });

      if (payload.reconnected) {
        showNotice('Reconnected to the live session.');
      }
      logSocketEvent('joined_game', {
        sessionId: payload.sessionId,
        playerId: payload.playerId,
        reconnected: payload.reconnected,
        gameState: payload.gameState,
      });
    });

    socket.on('session-updated', (payload) => {
      setSession((previous) => {
        const nextSession = {
          ...(previous || {}),
          ...payload,
          you: payload.you || previous?.you || null,
          playerToken: previous?.playerToken,
          playerId: previous?.playerId,
          isAdmin: payload.you?.isHost ?? previous?.isAdmin,
        };

        return nextSession;
      });

      if (payload.gameState === 'question' && payload.activePhaseData) {
        setQuestion((previous) => {
          if (previous?.roundId === payload.activePhaseData.roundId) {
            return {
              ...previous,
              submittedAnswerIndex:
                typeof payload.activePhaseData.submittedAnswerIndex === 'number'
                  ? payload.activePhaseData.submittedAnswerIndex
                  : previous.submittedAnswerIndex,
            };
          }

          return normalizeQuestionPayload(payload.activePhaseData);
        });
        setResults(null);
        setGameEnd(null);
      }

      if (payload.gameState === 'results' && payload.activePhaseData) {
        setResults(payload.activePhaseData);
        setQuestion(null);
        setGameEnd(null);
      }

      if (payload.gameState === 'ended' && payload.activePhaseData) {
        setGameEnd(payload.activePhaseData);
        setQuestion(null);
        setResults(null);
      }
    });

    socket.on('question-start', (payload) => {
      setQuestion(normalizeQuestionPayload(payload));
      setResults(null);
      setGameEnd(null);
      logSocketEvent('question_start', {
        roundId: payload.roundId,
        questionNumber: payload.questionNumber,
        endsAt: payload.questionEndsAt,
      });
    });

    socket.on('question-results', (payload) => {
      setResults(payload);
      setQuestion(null);
      logSocketEvent('question_results', {
        roundId: payload.roundId,
        correctAnswer: payload.correctAnswer,
        answerStats: payload.answerStats,
      });
    });

    socket.on('game-end', (payload) => {
      const activeSessionId = sessionRef.current?.sessionId || joinIntentRef.current?.sessionId;
      setGameEnd(payload);
      setQuestion(null);
      setResults(null);
      if (activeSessionId) {
        markPlayerSessionEnded(activeSessionId);
      }
      logSocketEvent('game_end', {
        leaderboardSize: payload.leaderboard?.length,
      });
    });

    socket.on('answer-submitted', (payload) => {
      setQuestion((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          submittedAnswerIndex:
            typeof previous.submittedAnswerIndex === 'number'
              ? previous.submittedAnswerIndex
              : payload.alreadySubmitted
                ? previous.submittedAnswerIndex
                : previous.pendingAnswerIndex,
          pendingAnswerIndex: null,
        };
      });
    });

    socket.on('player-joined', ({ username }) => {
      showNotice(`${username} joined the lobby.`);
    });

    socket.on('player-left', ({ username }) => {
      if (username) {
        showNotice(`${username} disconnected.`);
      }
    });

    socket.on('player-reconnected', ({ username }) => {
      showNotice(`${username} reconnected.`);
    });

    socket.on('admin-changed', ({ newAdminId, newAdminUsername }) => {
      setSession((previous) => {
        if (!previous) {
          return previous;
        }

        const isCurrentPlayer = previous.playerId === newAdminId;
        return {
          ...previous,
          isAdmin: isCurrentPlayer,
          you: previous.you
            ? {
                ...previous.you,
                isHost: isCurrentPlayer,
              }
            : previous.you,
        };
      });

      showNotice(`${newAdminUsername} is now the host.`);
    });

    socket.on('error', ({ message }) => {
      awaitingJoinRef.current = false;
      setQuestion((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          pendingAnswerIndex: null,
        };
      });

      const shouldTreatAsRecoverableMissingSession =
        message === 'Game session not found' &&
        Boolean(sessionRef.current?.sessionId) &&
        joinIntentRef.current?.sessionId === sessionRef.current?.sessionId &&
        connectionStatusRef.current !== 'connected';

      if (shouldTreatAsRecoverableMissingSession) {
        showNotice('Connection interrupted. Trying to restore the live room...');
        logSocketEvent('socket_error_recoverable', {
          message,
          sessionId: sessionRef.current?.sessionId,
        });
        return;
      }

      setError(message || 'Something went wrong');
      logSocketEvent('socket_error', {
        message,
      });
    });

    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
      socket.close();
    };
  }, [emitJoinGame, showNotice]);

  const ensureSocket = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) {
      throw new Error('Socket not ready');
    }

    if (!socket.connected) {
      setConnectionStatus('connecting');
      socket.connect();
    }

    return socket;
  }, []);

  const joinSession = useCallback(
    ({ sessionId, username, isCreator = false, forceFresh = false }) => {
      const socket = ensureSocket();
      setError('');
      emitJoinGame(socket, {
        sessionId,
        username,
        isCreator,
        forceFresh,
      });
    },
    [emitJoinGame, ensureSocket]
  );

  const startGame = useCallback(() => {
    ensureSocket().emit('start-game');
  }, [ensureSocket]);

  const submitAnswer = useCallback(
    (answerIndex) => {
      setQuestion((previous) => {
        if (!previous || typeof previous.submittedAnswerIndex === 'number') {
          return previous;
        }

        return {
          ...previous,
          pendingAnswerIndex: answerIndex,
        };
      });

      ensureSocket().emit('submit-answer', {
        answerIndex,
        roundId: questionRef.current?.roundId,
      });
    },
    [ensureSocket]
  );

  const nextQuestion = useCallback(() => {
    ensureSocket().emit('next-question');
  }, [ensureSocket]);

  const resyncSession = useCallback(() => {
    const socket = ensureSocket();
    const activeSession = sessionRef.current;
    const joinIntent = joinIntentRef.current;

    if (awaitingJoinRef.current) {
      return;
    }

    emitJoinGame(socket, {
      sessionId: activeSession?.sessionId || joinIntent?.sessionId,
      username: activeSession?.you?.username || joinIntent?.username,
      isCreator: Boolean(activeSession?.you?.isHost || joinIntent?.isCreator),
    });
  }, [emitJoinGame, ensureSocket]);

  useEffect(() => {
    const handleResume = () => {
      const activeSession = sessionRef.current;
      const joinIntent = joinIntentRef.current;
      const sessionId = activeSession?.sessionId || joinIntent?.sessionId;
      const username = activeSession?.you?.username || joinIntent?.username;

      if (!sessionId || !username || awaitingJoinRef.current) {
        return;
      }

      if (document.visibilityState && document.visibilityState !== 'visible') {
        return;
      }

      const socket = socketRef.current;
      if (!socket?.connected) {
        setConnectionStatus('connecting');
        socket?.connect();
        return;
      }

      resyncSession();
    };

    window.addEventListener('focus', handleResume);
    window.addEventListener('online', handleResume);
    document.addEventListener('visibilitychange', handleResume);

    return () => {
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, [resyncSession]);

  const leaveSession = useCallback(
    (sessionId, { forgetPlayer = false } = {}) => {
      if (forgetPlayer && sessionId) {
        clearPlayerSession(sessionId);
      }

      socketRef.current?.disconnect();
      awaitingJoinRef.current = false;
      joinIntentRef.current = null;
      setSession(null);
      setQuestion(null);
      setResults(null);
      setGameEnd(null);
      setConnectionStatus('disconnected');
      setError('');
      setNotice('');
    },
    []
  );

  const clearError = useCallback(() => {
    setError('');
  }, []);

  const value = useMemo(
    () => ({
      session,
      question,
      results,
      gameEnd,
      error,
      notice,
      connectionStatus,
      joinSession,
      startGame,
      submitAnswer,
      nextQuestion,
      resyncSession,
      leaveSession,
      clearError,
    }),
    [
      clearError,
      connectionStatus,
      error,
      gameEnd,
      joinSession,
      leaveSession,
      nextQuestion,
      notice,
      question,
      resyncSession,
      results,
      session,
      startGame,
      submitAnswer,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used inside GameProvider');
  }
  return context;
}
