import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getBackendUrl } from '../lib/api';
import { clearPlayerSession, loadPlayerSession, savePlayerSession } from '../lib/storage';

const GameContext = createContext(null);

function normalizeQuestionPayload(payload) {
  if (!payload) {
    return null;
  }

  const normalizedPayload = {
    ...payload,
  };

  return {
    ...normalizedPayload,
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
  const notificationTimerRef = useRef(null);
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

  useEffect(() => {
    const socket = io(getBackendUrl(), {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connected');
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('joined-game', (payload) => {
      setSession(payload);
      setQuestion(null);
      setResults(null);
      setGameEnd(null);
      savePlayerSession(payload.sessionId, {
        playerToken: payload.playerToken,
        playerId: payload.playerId,
        username: payload.you?.username || payload.username,
      });

      if (payload.reconnected) {
        showNotice('Reconnected to the live session.');
      }
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
            return previous;
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
    });

    socket.on('question-results', (payload) => {
      setResults(payload);
      setQuestion(null);
    });

    socket.on('game-end', (payload) => {
      setGameEnd(payload);
      setQuestion(null);
      setResults(null);
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
      setQuestion((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          pendingAnswerIndex: null,
        };
      });
      setError(message || 'Something went wrong');
    });

    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
      socket.close();
    };
  }, [showNotice]);

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
      const saved = forceFresh ? null : loadPlayerSession(sessionId);
      setError('');
      socket.emit('join-game', {
        sessionId,
        username,
        isCreator,
        playerToken: saved?.playerToken,
      });
    },
    [ensureSocket]
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

  const leaveSession = useCallback(
    (sessionId, { forgetPlayer = false } = {}) => {
      if (forgetPlayer && sessionId) {
        clearPlayerSession(sessionId);
      }

      socketRef.current?.disconnect();
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
