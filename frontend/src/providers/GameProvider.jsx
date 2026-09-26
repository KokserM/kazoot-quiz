import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getBackendUrl } from '../lib/api';
import { clearPlayerSession, loadPlayerSession, markPlayerSessionEnded, savePlayerSession } from '../lib/storage';

const GameContext = createContext(null);
const ACK_TIMEOUT_MS = 6000;

// Errors after which retrying the same room makes no sense.
const FATAL_JOIN_CODES = new Set(['room_not_found', 'game_ended', 'room_full', 'invalid_input']);

export const INITIAL_GAME_STATE = {
  seat: null, // { sessionId, playerId, playerToken, hostToken, username }
  session: null, // room-wide summary from the server
  question: null,
  myAnswer: null, // { roundId, index, status: 'sending' | 'locked' | 'failed', message }
  progress: null, // { roundId, answeredCount, connectedCount }
  results: null,
  roundResult: null,
  leaderboard: null,
};

export function buildJoinPayload({ sessionId, username, hostToken = null, saved = null }) {
  const payload = { sessionId, username };
  if (saved?.playerToken) payload.playerToken = saved.playerToken;
  const token = hostToken || saved?.hostToken;
  if (token) payload.hostToken = token;
  return payload;
}

// Applies a full server snapshot: used on join, reconnect and resync.
export function applySnapshot(state, snapshot, now = Date.now()) {
  const next = {
    ...state,
    session: snapshot.session,
    question: null,
    progress: null,
    results: null,
    roundResult: null,
    leaderboard: null,
  };
  if (snapshot.phase === 'question' && snapshot.question) {
    next.question = { ...snapshot.question, clientReceivedAt: now };
    next.progress = { roundId: snapshot.question.roundId, answeredCount: snapshot.answeredCount || 0 };
    const keep = state.myAnswer?.roundId === snapshot.question.roundId ? state.myAnswer : null;
    next.myAnswer =
      typeof snapshot.yourAnswerIndex === 'number'
        ? { roundId: snapshot.question.roundId, index: snapshot.yourAnswerIndex, status: 'locked' }
        : keep && keep.status !== 'locked'
          ? keep
          : null;
  } else if (snapshot.phase === 'results') {
    next.results = snapshot.results;
    next.roundResult = snapshot.roundResult;
    next.myAnswer = null;
  } else if (snapshot.phase === 'ended') {
    next.leaderboard = snapshot.leaderboard;
    next.myAnswer = null;
  }
  return next;
}

export function GameProvider({ children }) {
  const socketRef = useRef(null);
  const socketPromiseRef = useRef(null);
  const stateRef = useRef(INITIAL_GAME_STATE);
  const joinIntentRef = useRef(null); // { sessionId, username, hostToken }
  const [state, setStateRaw] = useState(INITIAL_GAME_STATE);
  const [connection, setConnection] = useState('idle'); // idle | connecting | connected | reconnecting | offline
  const [joinError, setJoinError] = useState(null); // { code, message, fatal }
  const [restarting, setRestarting] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const setState = useCallback((updater) => {
    setStateRaw((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater;
      stateRef.current = next;
      return next;
    });
  }, []);

  const showToast = useCallback((message) => {
    clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const emitJoin = useCallback(
    async (socket) => {
      const intent = joinIntentRef.current;
      if (!intent) return;
      // Only reuse a saved seat that belongs to the name being joined with: two tabs
      // in one browser share storage, and a typed new name means a new player.
      const saved = intent.fresh ? null : loadPlayerSession(intent.sessionId, { username: intent.username });
      const payload = buildJoinPayload({ ...intent, saved });
      try {
        const ack = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('join-game', payload);
        if (!ack.ok) {
          const fatal = FATAL_JOIN_CODES.has(ack.code);
          setJoinError({ code: ack.code, message: ack.message, fatal });
          if (fatal && ack.code === 'room_not_found') {
            clearPlayerSession(intent.sessionId);
          }
        } else {
          setJoinError(null);
          intent.fresh = false;
        }
      } catch {
        // No acknowledgement: the socket will reconnect and we try again.
      }
    },
    []
  );

  // Socket.IO is loaded on first use (joining a game), not on the landing page.
  const ensureSocket = useCallback(async () => {
    if (socketRef.current) return socketRef.current;
    if (!socketPromiseRef.current) {
      socketPromiseRef.current = import('socket.io-client').then(({ io }) => {
        if (!socketRef.current) {
          socketRef.current = createSocket(io);
        }
        return socketRef.current;
      });
    }
    return socketPromiseRef.current;
  }, []);

  const createSocket = (io) => {
    const socket = io(getBackendUrl(), {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5, // spreads reconnect storms after a restart
      timeout: 15000,
    });
    socket.on('connect', () => {
      setConnection('connected');
      setRestarting(null);
      if (joinIntentRef.current) {
        emitJoin(socket);
      }
    });
    socket.on('disconnect', (reason) => {
      setConnection(reason === 'io client disconnect' ? 'idle' : 'reconnecting');
    });
    socket.io.on('reconnect_attempt', () => setConnection(navigator.onLine === false ? 'offline' : 'reconnecting'));
    socket.on('connect_error', () => setConnection(navigator.onLine === false ? 'offline' : 'reconnecting'));

    const rememberSeat = (payload) => {
      const username = payload.session.players.find((player) => player.playerId === payload.playerId)?.username || joinIntentRef.current?.username;
      const seat = {
        sessionId: payload.session.sessionId,
        playerId: payload.playerId,
        playerToken: payload.playerToken,
        hostToken: payload.hostToken,
        username,
      };
      savePlayerSession(seat.sessionId, seat);
      joinIntentRef.current = { sessionId: seat.sessionId, username, hostToken: seat.hostToken };
      setState((previous) => ({ ...previous, seat, session: payload.session }));
      return seat;
    };

    socket.on('joined-game', (payload) => {
      rememberSeat(payload);
      if (payload.reconnected && stateRef.current.seat) {
        showToast('Reconnected.');
      }
    });
    socket.on('next-game-ready', (payload) => {
      if (payload.previousSessionId) markPlayerSessionEnded(payload.previousSessionId);
      rememberSeat(payload);
      setState((previous) => ({ ...INITIAL_GAME_STATE, seat: previous.seat, session: payload.session }));
      showToast(payload.hostToken ? 'Your next game is ready.' : 'The host started the next game.');
    });
    socket.on('state-snapshot', (snapshot) => setState((previous) => applySnapshot(previous, snapshot)));
    socket.on('session-updated', (session) => {
      setState((previous) => (previous.session && previous.session.sessionId !== session.sessionId ? previous : { ...previous, session }));
    });
    socket.on('question-start', (question) => {
      setState((previous) => ({
        ...previous,
        question: { ...question, clientReceivedAt: Date.now() },
        progress: { roundId: question.roundId, answeredCount: 0 },
        myAnswer: null,
        results: null,
        roundResult: null,
      }));
    });
    socket.on('answer-progress', (progress) => {
      setState((previous) => (previous.question?.roundId === progress.roundId ? { ...previous, progress } : previous));
    });
    socket.on('question-results', (results) => {
      setState((previous) => ({ ...previous, question: null, progress: null, results, roundResult: previous.roundResult?.roundId === results.roundId ? previous.roundResult : null }));
    });
    socket.on('round-result', (roundResult) => {
      setState((previous) => ({ ...previous, roundResult, myAnswer: null }));
    });
    socket.on('game-end', ({ leaderboard }) => {
      const sessionId = stateRef.current.seat?.sessionId;
      if (sessionId) markPlayerSessionEnded(sessionId);
      setState((previous) => ({ ...previous, question: null, results: null, leaderboard }));
    });
    socket.on('host-changed', ({ playerId, username, role }) => {
      const mine = stateRef.current.seat?.playerId === playerId;
      showToast(mine ? (role === 'temporary' ? 'The host is away — you can keep the game moving.' : 'You are the host.') : `${username} is now running the game.`);
    });
    socket.on('player-reconnected', ({ username }) => showToast(`${username} is back.`));
    socket.on('server-restarting', ({ message }) => setRestarting(message));
    socket.on('action-error', ({ message }) => showToast(message));
    return socket;
  };

  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      const socket = socketRef.current;
      if (socket) {
        socket.removeAllListeners();
        socket.io.removeAllListeners();
        socket.close();
      }
    },
    []
  );

  // Resync when the tab comes back: phones pause background tabs.
  useEffect(() => {
    const resume = async () => {
      if (document.visibilityState === 'hidden' || !joinIntentRef.current) return;
      const socket = socketRef.current;
      if (!socket) return;
      if (!socket.connected) {
        setConnection('reconnecting');
        socket.connect();
        return;
      }
      try {
        const ack = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck('sync-state', {});
        if (!ack.ok) emitJoin(socket);
      } catch {
        // Socket will notice the broken connection and reconnect.
      }
    };
    const offline = () => setConnection('offline');
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    window.addEventListener('offline', offline);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
      window.removeEventListener('offline', offline);
    };
  }, [emitJoin]);

  const join = useCallback(
    async ({ sessionId, username, hostToken = null, fresh = false }) => {
      joinIntentRef.current = { sessionId: sessionId.toUpperCase(), username, hostToken, fresh };
      setJoinError(null);
      if (stateRef.current.session?.sessionId !== sessionId.toUpperCase()) {
        setState(INITIAL_GAME_STATE);
      }
      setConnection('connecting');
      const socket = await ensureSocket();
      if (socket.connected) {
        emitJoin(socket);
      } else {
        setConnection('connecting');
        socket.connect();
      }
    },
    [emitJoin, ensureSocket, setState]
  );

  const act = useCallback(async (eventName, payload = {}) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      return { ok: false, code: 'offline', message: 'You’re offline. Reconnecting…' };
    }
    try {
      return await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(eventName, payload);
    } catch {
      return { ok: false, code: 'timeout', message: 'No response from the server. Please try again.' };
    }
  }, []);

  const submitAnswer = useCallback(
    async (index) => {
      const { question, myAnswer } = stateRef.current;
      if (!question || (myAnswer && myAnswer.roundId === question.roundId && myAnswer.status !== 'failed')) return;
      const roundId = question.roundId;
      setState((previous) => ({ ...previous, myAnswer: { roundId, index, status: 'sending' } }));
      const ack = await act('submit-answer', { answerIndex: index, roundId });
      setState((previous) => {
        if (previous.question?.roundId !== roundId) return previous;
        if (ack.ok) {
          return { ...previous, myAnswer: { roundId, index: ack.answerIndex, status: 'locked' } };
        }
        // Never pretend a failed answer counted.
        return { ...previous, myAnswer: { roundId, index, status: 'failed', message: ack.message, code: ack.code } };
      });
    },
    [act, setState]
  );

  const startGame = useCallback(async () => {
    const ack = await act('start-game');
    if (!ack.ok) showToast(ack.message);
    return ack;
  }, [act, showToast]);

  const nextQuestion = useCallback(async () => {
    const fromQuestionIndex = stateRef.current.results?.questionIndex ?? stateRef.current.session?.currentQuestionIndex;
    const ack = await act('next-question', { fromQuestionIndex });
    if (!ack.ok) showToast(ack.message);
    return ack;
  }, [act, showToast]);

  const leave = useCallback(
    async ({ forget = false } = {}) => {
      const sessionId = stateRef.current.seat?.sessionId || joinIntentRef.current?.sessionId;
      if (socketRef.current?.connected) {
        await act('leave-game');
      }
      if (forget && sessionId) clearPlayerSession(sessionId);
      joinIntentRef.current = null;
      socketRef.current?.disconnect();
      setState(INITIAL_GAME_STATE);
      setJoinError(null);
      setRestarting(null);
      setConnection('idle');
    },
    [act, setState]
  );

  // Navigating away: close the connection but keep the saved seat, so the
  // back button (or the invite link) returns the player to the same place.
  const detach = useCallback(() => {
    joinIntentRef.current = null;
    socketRef.current?.disconnect();
    setState(INITIAL_GAME_STATE);
    setJoinError(null);
    setRestarting(null);
    setConnection('idle');
  }, [setState]);

  const retryJoin = useCallback(() => {
    const socket = socketRef.current;
    if (!joinIntentRef.current || !socket) return;
    setJoinError(null);
    if (socket.connected) emitJoin(socket);
    else socket.connect();
  }, [emitJoin]);

  const value = useMemo(
    () => ({
      ...state,
      connection,
      joinError,
      restarting,
      toast,
      isHost: Boolean(state.seat && state.session?.hostPlayerId === state.seat.playerId),
      join,
      detach,
      retryJoin,
      submitAnswer,
      startGame,
      nextQuestion,
      leave,
    }),
    [state, connection, joinError, restarting, toast, join, detach, retryJoin, submitAnswer, startGame, nextQuestion, leave]
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
