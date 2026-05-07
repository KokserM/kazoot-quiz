import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { afterEach, expect, test } from 'vitest';
import App, {
  getCreateButtonLabel,
  getCreateLoadingMessage,
  getCreateLoadingMessages,
  getContinuationInitialFormState,
  formatCorrectAnswerCount,
  getGameEndActionLayoutColumns,
  getGameEndActionLabels,
  getHostNameAutofill,
  getHostAuthorityLabel,
  getNextGameOptionGridColumns,
  getNextGameRulesLayoutColumns,
  getRevealTimingLabel,
  getRemainingQuestionMs,
  getResultsTitle,
  getSessionPhase,
  getSubmittedAnswerMessage,
  SessionToast,
  shouldShowSessionErrorBanner,
  shouldNavigateAfterSuccessorTransfer,
  shouldAttemptQuestionResync,
  shouldShowSessionJoinLoading,
} from './App';
import { buildJoinGamePayload, getSocketTransports, persistNextGameSession } from './providers/GameProvider';
import { INITIAL_AUTH_STATE, reduceAuthSessionState } from './auth/AuthProvider';
import {
  DEFAULT_HOST_PREFERENCES,
  getHostPreferencesStorageKey,
  loadHostPreferences,
  normalizeHostPreferences,
  saveHostPreferences,
} from './lib/hostPreferences';
import { clearPlayerSession, loadPlayerSession, markPlayerSessionEnded, savePlayerSession } from './lib/storage';
import { getSupportEmail } from './lib/support';
import { getOAuthRedirectTo } from './lib/supabase';
import { getSignedOutAuthCopy, getUsageSummaryLabel } from './components/AccountStatusBar';
import { formatPlanPrice, formatPricePerAiGame, getPlanCreditLine } from './pages/AccountPage';
import { theme } from './styles/theme';

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

test('renders Kazoot marketing headline', () => {
  render(<App />);
  expect(
    screen.getByText(/Host a quiz night your friends can join in seconds/i)
  ).toBeInTheDocument();
});

test('renders create route without requiring game session state', async () => {
  window.history.pushState({}, '', '/create');
  render(<App />);
  expect(await screen.findByText(/Checking your sign-in|How would you like to host|Create your game/i)).toBeInTheDocument();
});

test('renders trust footer with support and policy links', () => {
  render(<App />);
  expect(screen.getByText(/Questions before buying/i)).toBeInTheDocument();
  expect(screen.getByText(/support@kazoot\.app/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy');
  expect(screen.getByRole('link', { name: /refunds/i })).toHaveAttribute('href', '/refunds');
});

test('support email falls back to kazoot address and respects env override', () => {
  expect(getSupportEmail({})).toBe('support@kazoot.app');
  expect(getSupportEmail({ VITE_SUPPORT_EMAIL: ' help@example.com ' })).toBe('help@example.com');
});

test('stale initial auth session cannot overwrite a newer signed-in event', () => {
  const signedInSession = {
    access_token: 'access-token',
    user: { id: 'user-1', email: 'host@example.com' },
  };

  const signedInState = reduceAuthSessionState(INITIAL_AUTH_STATE, {
    type: 'auth-event',
    event: 'SIGNED_IN',
    session: signedInSession,
  });
  const staleInitialState = reduceAuthSessionState(signedInState, {
    type: 'initial-session',
    session: null,
  });

  expect(staleInitialState.session).toBe(signedInSession);
  expect(staleInitialState.isAuthLoading).toBe(false);
});

test('signed-out auth copy stays neutral while auth initializes', () => {
  expect(getSignedOutAuthCopy(true)).toEqual({
    benefit: 'Checking sign-in...',
    button: 'Checking account...',
    disabled: true,
  });
  expect(getSignedOutAuthCopy(false)).toEqual({
    benefit: 'Host 3 AI games free this month',
    button: 'Sign in for AI games',
    disabled: false,
  });
});

test('oauth redirect helper returns stable production-safe routes', () => {
  expect(getOAuthRedirectTo({ origin: 'https://kazoot.app', pathname: '/' })).toBe('https://kazoot.app/account');
  expect(getOAuthRedirectTo({ origin: 'https://kazoot.app', pathname: '/create' })).toBe('https://kazoot.app/create');
});

test('refund policy page explains fair credit handling', async () => {
  window.history.pushState({}, '', '/refunds');
  render(<App />);

  expect(await screen.findByText(/Refund Policy/i)).toBeInTheDocument();
  expect(await screen.findByText(/If an AI game is not successfully created/i)).toBeInTheDocument();
  expect(await screen.findByText(/We aim to reply within 2 business days/i)).toBeInTheDocument();
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

test('session notices render in an accessible toast layer', () => {
  render(
    <ThemeProvider theme={theme}>
      <SessionToast notice={{ id: 'join-1', message: 'Alex joined the lobby.', tone: 'info' }} />
    </ThemeProvider>
  );

  const toastViewport = screen.getByTestId('session-toast-viewport');
  const toast = screen.getByRole('status');

  expect(toastViewport).toHaveAttribute('aria-live', 'polite');
  expect(toastViewport).toContainElement(toast);
  expect(toast).toHaveTextContent('Alex joined the lobby.');
});

test('session toast layer does not render a status when there is no notice', () => {
  render(
    <ThemeProvider theme={theme}>
      <SessionToast notice={null} />
    </ThemeProvider>
  );

  expect(screen.getByTestId('session-toast-viewport')).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('blocking session errors still use the in-page error banner path', () => {
  expect(shouldShowSessionErrorBanner('Only the game host can start the game')).toBe(true);
  expect(shouldShowSessionErrorBanner('')).toBe(false);
});

test('successor transfer navigates instead of leaving the active socket session', () => {
  expect(
    shouldNavigateAfterSuccessorTransfer({
      currentSessionId: 'OLDROOM123',
      session: {
        sessionId: 'NEWROOM456',
        previousSessionId: 'OLDROOM123',
      },
    })
  ).toBe(true);

  expect(
    shouldNavigateAfterSuccessorTransfer({
      currentSessionId: 'OTHERROOM1',
      session: {
        sessionId: 'NEWROOM456',
        previousSessionId: 'OLDROOM123',
      },
    })
  ).toBe(false);
});

test('successor game local storage saves the new seat and expires the old one', () => {
  savePlayerSession('OLDROOM123', {
    playerToken: 'old-player-token',
    hostToken: 'old-host-token',
    playerId: 'old-player-id',
    username: 'Host',
  });

  persistNextGameSession({
    previousSessionId: 'OLDROOM123',
    sessionId: 'NEWROOM456',
    playerToken: 'new-player-token',
    hostToken: 'new-host-token',
    playerId: 'new-player-id',
    you: {
      username: 'Host',
    },
  });

  expect(loadPlayerSession('NEWROOM456')).toMatchObject({
    playerToken: 'new-player-token',
    hostToken: 'new-host-token',
    playerId: 'new-player-id',
    username: 'Host',
  });
  expect(loadPlayerSession('OLDROOM123', { allowUsernameMismatch: true }).gameEndedAt).toEqual(expect.any(Number));
});

test('successor final-screen actions stay distinct from brand-new games', () => {
  expect(getGameEndActionLabels({ isHost: true })).toEqual([
    'Play another with this group',
    'Start a brand-new game',
  ]);
  expect(getGameEndActionLabels({ isHost: false })).toEqual(['Waiting for the host']);
});

test('final host actions stack under standings on every viewport', () => {
  expect(getGameEndActionLayoutColumns()).toBe('1fr');
});

test('next-game rules stack and use equal-width option grids on desktop', () => {
  expect(getNextGameRulesLayoutColumns()).toBe('1fr');
  expect(getNextGameOptionGridColumns('190px')).toBe('repeat(auto-fit, minmax(190px, 1fr))');
  expect(getNextGameOptionGridColumns('120px')).toBe('repeat(auto-fit, minmax(120px, 1fr))');
});

test('successor continuation form starts with a blank topic and editable host rules', () => {
  expect(
    getContinuationInitialFormState({
      language: 'Estonian',
      questionTimeLimitMs: '10000',
      revealTiming: 'all_answered',
    })
  ).toEqual({
    topic: '',
    language: 'Estonian',
    questionTimeLimitMs: '10000',
    revealTiming: 'all_answered',
  });
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

test('host preferences validate values before saving or loading', () => {
  expect(
    normalizeHostPreferences({
      language: 'Estonian',
      questionTimeLimitMs: '10000',
      revealTiming: 'all_answered',
    })
  ).toEqual({
    language: 'Estonian',
    questionTimeLimitMs: '10000',
    revealTiming: 'all_answered',
  });

  expect(
    normalizeHostPreferences({
      language: 'Secret',
      questionTimeLimitMs: '99999',
      revealTiming: 'instant',
    })
  ).toEqual(DEFAULT_HOST_PREFERENCES);
});

test('host preferences use opaque account keys without raw supabase ids', async () => {
  const rawUserId = '00000000-0000-4000-8000-000000000123';
  const key = await getHostPreferencesStorageKey(rawUserId);

  expect(key).toMatch(/^kazoot:hostPreferences:user:/);
  expect(key).not.toContain(rawUserId);
});

test('anonymous and signed-in host preferences stay separate', async () => {
  const rawUserId = '00000000-0000-4000-8000-000000000456';

  await saveHostPreferences(null, {
    language: 'Estonian',
    questionTimeLimitMs: '5000',
    revealTiming: 'all_answered',
  });
  await saveHostPreferences(rawUserId, {
    language: 'English',
    questionTimeLimitMs: '20000',
    revealTiming: 'timer',
  });

  await expect(loadHostPreferences(null)).resolves.toEqual({
    language: 'Estonian',
    questionTimeLimitMs: '5000',
    revealTiming: 'all_answered',
  });
  await expect(loadHostPreferences(rawUserId)).resolves.toEqual({
    language: 'English',
    questionTimeLimitMs: '20000',
    revealTiming: 'timer',
  });
});

test('results title prefers question text with old payload fallback', () => {
  expect(getResultsTitle({ questionText: 'Which planet is known as the Red Planet?' })).toBe(
    'Which planet is known as the Red Planet?'
  );
  expect(getResultsTitle({ correctAnswer: 1, correctAnswerText: 'Mars' })).toBe('Answer B was correct: Mars');
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

test('formats visible billing plan prices and AI-game lines', () => {
  expect(formatPlanPrice({ amountCents: 500, currency: 'EUR', interval: 'month' })).toBe('€5 / month');
  expect(formatPlanPrice({ amountCents: 1200, currency: 'EUR' })).toBe('€12 one-time');
  expect(formatPricePerAiGame({ pricePerAiGameCents: 17, currency: 'EUR' })).toBe('€0.17 per AI game');
  expect(getPlanCreditLine({ mode: 'subscription', credits: 30 })).toBe('30 AI games each month');
  expect(getPlanCreditLine({ mode: 'payment', credits: 20 })).toBe('20 AI games, valid 12 months');
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
