import { render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import App, {
  getCreateButtonLabel,
  getCreateLoadingMessage,
  getCreateLoadingMessages,
  getHostAuthorityLabel,
  getRevealTimingLabel,
  getRemainingQuestionMs,
  getSessionPhase,
  getSubmittedAnswerMessage,
  shouldAttemptQuestionResync,
  shouldShowSessionJoinLoading,
} from './App';
import { buildJoinGamePayload, getSocketTransports } from './providers/GameProvider';
import { clearPlayerSession, loadPlayerSession, markPlayerSessionEnded, savePlayerSession } from './lib/storage';

afterEach(() => {
  localStorage.clear();
});

test('renders Kazoot marketing headline', () => {
  render(<App />);
  expect(
    screen.getByText(/Kazoot brings reliable multiplayer quiz nights back to life/i)
  ).toBeInTheDocument();
});

test('countdown keeps decreasing after local question state changes', () => {
  const question = {
    serverTime: 1_000,
    clientReceivedAt: 1_020,
    questionEndsAt: 21_000,
  };

  const beforeSubmit = getRemainingQuestionMs(question, 6_000);
  const afterLocalStateChange = getRemainingQuestionMs(
    {
      ...question,
      pendingAnswerIndex: 2,
    },
    9_000
  );

  expect(beforeSubmit).toBe(15_020);
  expect(afterLocalStateChange).toBe(12_020);
});

test('results phase wins even if session summary is stale', () => {
  expect(
    getSessionPhase({
      activeSession: { gameState: 'question' },
      question: null,
      results: { correctAnswer: 1 },
      gameEnd: null,
    })
  ).toBe('results');
});

test('shows loading state instead of join form during auto-join', () => {
  expect(
    shouldShowSessionJoinLoading({
      activeSession: null,
      joinAttempted: true,
      hasKnownUsername: true,
      error: '',
    })
  ).toBe(true);

  expect(
    shouldShowSessionJoinLoading({
      activeSession: { sessionId: 'ABC123' },
      joinAttempted: true,
      hasKnownUsername: true,
      error: '',
    })
  ).toBe(false);
});

test('only attempts timeout resync when disconnected', () => {
  expect(
    shouldAttemptQuestionResync({
      remainingMs: 0,
      connectionStatus: 'connected',
      hasResyncHandler: true,
    })
  ).toBe(false);

  expect(
    shouldAttemptQuestionResync({
      remainingMs: 0,
      connectionStatus: 'disconnected',
      hasResyncHandler: true,
    })
  ).toBe(true);
});

test('local development keeps websocket fallback transports', () => {
  expect(getSocketTransports()).toEqual(['polling', 'websocket']);
});

test('join-game payload omits null optional tokens while preserving real reconnect tokens', () => {
  const playerPayload = buildJoinGamePayload({
    sessionId: 'ABC12345JK',
    username: 'Guest',
    isCreator: false,
    saved: {
      playerToken: 'player-token-123',
      hostToken: null,
    },
  });

  expect(playerPayload).toEqual({
    sessionId: 'ABC12345JK',
    username: 'Guest',
    isCreator: false,
    playerToken: 'player-token-123',
  });
  expect(playerPayload).not.toHaveProperty('hostToken');

  expect(
    buildJoinGamePayload({
      sessionId: 'ABC12345JK',
      username: 'Host',
      isCreator: true,
      hostToken: 'fresh-host-token-123',
      saved: {
        playerToken: 'host-player-token-123',
        hostToken: 'stale-host-token-123',
      },
    })
  ).toEqual({
    sessionId: 'ABC12345JK',
    username: 'Host',
    isCreator: true,
    playerToken: 'host-player-token-123',
    hostToken: 'fresh-host-token-123',
  });
});

test('formats reveal timing labels and submitted answer copy', () => {
  expect(getRevealTimingLabel('all_answered')).toBe('Reveal: when all answer');
  expect(getRevealTimingLabel('timer')).toBe('Reveal: timer ends');
  expect(getSubmittedAnswerMessage('all_answered')).toMatch(/other players/i);
  expect(getSubmittedAnswerMessage('timer')).toMatch(/timer/i);
});

test('formats owner and temporary host labels', () => {
  expect(getHostAuthorityLabel({ isHost: true, hostAuthority: 'owner' })).toBe('Host');
  expect(getHostAuthorityLabel({ isHost: true, hostAuthority: 'temporary' })).toBe('Temporary host');
  expect(getHostAuthorityLabel({ isHost: false, hostAuthority: 'none' })).toBe('Player');
});

test('formats create loading copy for AI and demo sessions', () => {
  const aiMessages = getCreateLoadingMessages({ user: { id: 'user-1' }, hasOpenAI: true });
  const demoMessages = getCreateLoadingMessages({ user: null, hasOpenAI: true });

  expect(
    getCreateButtonLabel({
      isLoading: true,
      isSignedInAiBlocked: false,
      user: { id: 'user-1' },
      hasOpenAI: true,
    })
  ).toBe('Generating questions...');
  expect(getCreateLoadingMessage({ user: { id: 'user-1' }, hasOpenAI: true })).toBe(aiMessages[0]);
  expect(aiMessages).toContain('Thinking hard to provide a challenge...');

  expect(
    getCreateButtonLabel({
      isLoading: true,
      isSignedInAiBlocked: false,
      user: null,
      hasOpenAI: true,
    })
  ).toBe('Creating demo room...');
  expect(getCreateLoadingMessage({ user: null, hasOpenAI: true })).toBe(demoMessages[0]);
  expect(demoMessages).toContain('Loading built-in questions...');
});

test('stored player sessions are scoped by username and can be cleared', () => {
  savePlayerSession('ABC12345JK', {
    playerToken: 'token-1',
    playerId: 'player-1',
    username: 'Martin',
  });

  expect(loadPlayerSession('ABC12345JK', { username: 'Martin' })?.playerToken).toBe('token-1');
  expect(loadPlayerSession('ABC12345JK', { username: 'Someone Else' })).toBeNull();
  expect(loadPlayerSession('ABC12345JK', { username: 'Someone Else', allowUsernameMismatch: true })?.username).toBe(
    'Martin'
  );

  clearPlayerSession('ABC12345JK');
  expect(loadPlayerSession('ABC12345JK', { allowUsernameMismatch: true })).toBeNull();
});

test('ended player sessions are retained briefly then expire', () => {
  savePlayerSession('ABC12345JL', {
    playerToken: 'token-2',
    playerId: 'player-2',
    username: 'Mobile Player',
  });

  markPlayerSessionEnded('ABC12345JL');
  const saved = loadPlayerSession('ABC12345JL', { username: 'Mobile Player' });
  expect(saved?.gameEndedAt).toEqual(expect.any(Number));
  expect(saved?.expiresAt).toBeGreaterThan(Date.now());
});
