import { render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import App, {
  getCreateButtonLabel,
  getCreateLoadingMessage,
  getCreateLoadingMessages,
  formatCorrectAnswerCount,
  getHostNameAutofill,
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
import { getUsageSummaryLabel } from './components/AccountStatusBar';

afterEach(() => {
  localStorage.clear();
});

test('renders Kazoot marketing headline', () => {
  render(<App />);
  expect(
    screen.getByText(/Host a quiz night your friends can join in seconds/i)
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

test('formats final standings correct-answer count when available', () => {
  expect(formatCorrectAnswerCount({ correctAnswerCount: 7, totalQuestions: 10 })).toBe('7/10 correct');
  expect(formatCorrectAnswerCount({ correctAnswerCount: 0, totalQuestions: 10 })).toBe('0/10 correct');
  expect(formatCorrectAnswerCount({ score: 1200 })).toBe('');
});

test('formats reveal timing labels and submitted answer copy', () => {
  expect(getRevealTimingLabel('all_answered')).toBe('Reveal: everyone answered');
  expect(getRevealTimingLabel('timer')).toBe('Reveal: full timer');
  expect(getSubmittedAnswerMessage('all_answered')).toMatch(/everyone else/i);
  expect(getSubmittedAnswerMessage('timer')).toMatch(/time is up/i);
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
  ).toBe('Preparing your game...');
  expect(getCreateLoadingMessage({ user: { id: 'user-1' }, hasOpenAI: true })).toBe(aiMessages[0]);
  expect(aiMessages).toContain('Building a balanced challenge...');

  expect(
    getCreateButtonLabel({
      isLoading: true,
      isSignedInAiBlocked: false,
      user: null,
      hasOpenAI: true,
    })
  ).toBe('Creating demo game...');
  expect(getCreateLoadingMessage({ user: null, hasOpenAI: true })).toBe(demoMessages[0]);
  expect(demoMessages).toContain('Loading a ready-made question set...');
});

test('formats monthly AI games left copy', () => {
  expect(getCreateButtonLabel({
    isLoading: false,
    isSignedInAiBlocked: true,
    user: { id: 'user-1' },
    hasOpenAI: true,
  })).toBe('Add AI games to host again');

  expect(
    getUsageSummaryLabel({
      freeRemainingThisMonth: 3,
      credits: 20,
    })
  ).toBe('3 free this month · 20 paid AI games left');
});

test('prefills host name from Google profile until user edits it', () => {
  const user = {
    email: 'host@example.com',
    user_metadata: {
      full_name: 'Alex Host',
    },
  };

  expect(getHostNameAutofill({ user, currentUsername: '', hasEditedUsername: false })).toBe('Alex Host');
  expect(getHostNameAutofill({ user, currentUsername: 'Custom Host', hasEditedUsername: true })).toBe('Custom Host');
  expect(getHostNameAutofill({ user: null, currentUsername: '', hasEditedUsername: false })).toBe('');
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
