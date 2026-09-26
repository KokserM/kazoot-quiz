import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { INITIAL_AUTH_STATE, reduceAuthSessionState, AuthProvider } from './auth/AuthProvider';
import { AnswerGrid } from './components/game/AnswerGrid';
import { describePlan, formatMoney } from './components/Pricing';
import { describeMyAnswer, getRemainingMs, isValidRoomCode, normalizeRoomCode, ordinal } from './lib/gameUi';
import { DEFAULT_HOST_PREFERENCES, getHostPreferencesStorageKey, loadHostPreferences, normalizeHostPreferences, saveHostPreferences } from './lib/hostPreferences';
import { clearPlayerSession, loadPlayerSession, markPlayerSessionEnded, savePlayerSession } from './lib/storage';
import { getSupportEmail } from './lib/support';
import { getOAuthRedirectTo } from './lib/supabase';
import { describeSubscription } from './pages/AccountPage';
import { describeAllowance } from './pages/CreatePage';
import HomePage from './pages/HomePage';
import JoinPage from './pages/JoinPage';
import { applySnapshot, buildJoinPayload, INITIAL_GAME_STATE } from './providers/GameProvider';
import { DARK_COLORS, LIGHT_COLORS } from './styles/tokens';

const CONFIG = {
  aiAvailable: true,
  freeAiGamesPerMonth: 3,
  maxPlayersPerRoom: 150,
  maxDemoPlayers: 30,
  demoQuizzes: [{ id: 'warm-up', title: 'Quick warm-up', description: 'x', language: 'English', questionCount: 10 }],
};
const PLANS = [
  { id: 'credits_20', name: 'Pack 20', mode: 'payment', credits: 20, amountCents: 500, currency: 'EUR', validityMonths: 12, pricePerAiGameCents: 25, configured: true },
  { id: 'plus_monthly', name: 'Plus', mode: 'subscription', credits: 30, amountCents: 500, currency: 'EUR', interval: 'month', pricePerAiGameCents: 17, configured: true },
];

beforeEach(() => {
  globalThis.fetch = vi.fn(async (url) => ({
    ok: true,
    json: async () => (String(url).includes('/api/config') ? CONFIG : String(url).includes('/api/billing/catalog') ? { plans: PLANS } : {}),
  }));
  navigator.sendBeacon = vi.fn(() => true);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

function renderAt(path, element, routePath = path) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

// ------------------------------------------------------------------ landing

test('landing page leads with the host-plays-too promise and both calls to action', async () => {
  renderAt('/', <HomePage />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pick a topic. Everyone plays — including you.');
  expect(screen.getAllByRole('link', { name: 'Try a free demo' })[0]).toHaveAttribute('href', '/demo');
  expect(screen.getByRole('link', { name: 'Create a quiz' })).toHaveAttribute('href', '/create');
  // Pricing comes from the server catalog, not hard-coded copy.
  expect(await screen.findByText('€5 / month')).toBeInTheDocument();
  expect(screen.getByText(/AI can be wrong/)).toBeInTheDocument();
  expect(navigator.sendBeacon).toHaveBeenCalled();
});

test('landing page makes no unsupported claims', () => {
  const { container } = renderAt('/', <HomePage />);
  const text = container.textContent.toLowerCase();
  for (const claim of ['any topic', 'unlimited players', 'instant', 'guaranteed', 'always accurate', 'testimonial']) {
    expect(text).not.toContain(claim);
  }
});

// --------------------------------------------------------------------- join

test('join page accepts the 10-character room codes the server issues', () => {
  renderAt('/join', <JoinPage />);
  const code = screen.getByLabelText('Room code');
  fireEvent.change(code, { target: { value: 'abcde-23456' } });
  expect(code).toHaveValue('ABCDE23456');
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Mari' } });
  expect(screen.getByRole('button', { name: 'Join game' })).toBeEnabled();
});

test('join links prefill the code from the URL', () => {
  renderAt('/join/ABCDE23456', <JoinPage />, '/join/:code');
  expect(screen.getByLabelText('Room code')).toHaveValue('ABCDE23456');
});

test('room code helpers', () => {
  expect(normalizeRoomCode(' ab cd-e2 3456x ')).toBe('ABCDE23456');
  expect(isValidRoomCode('ABCDE23456')).toBe(true);
  expect(isValidRoomCode('ABCD1234')).toBe(true);
  expect(isValidRoomCode('ABC')).toBe(false);
});

// --------------------------------------------------------------- gameplay

test('countdown uses the server clock offset, not the phone clock', () => {
  const question = { questionEndsAt: 20_000, serverTime: 10_000, clientReceivedAt: 50_000 };
  // Phone clock is 40 s ahead of the server: remaining time is still 10 s.
  expect(getRemainingMs(question, 50_000)).toBe(10_000);
  expect(getRemainingMs(question, 65_000)).toBe(0);
});

test('a failed answer is never shown as locked in', () => {
  expect(describeMyAnswer({ status: 'failed', message: 'That question has already closed.' }).tone).toBe('danger');
  expect(describeMyAnswer({ status: 'failed' }).text).toMatch(/try again/i);
  expect(describeMyAnswer({ status: 'sending' }).text).toMatch(/Sending/);
  expect(describeMyAnswer({ status: 'locked' }, 'timer').text).toMatch(/locked in/);
});

test('answer buttons are keyboard-operable and report the pressed choice', () => {
  const onSelect = vi.fn();
  render(<AnswerGrid choices={['A1', 'B1', 'C1', 'D1']} onSelect={onSelect} />);
  const buttons = screen.getAllByRole('button');
  expect(buttons).toHaveLength(4);
  fireEvent.click(buttons[2]);
  expect(onSelect).toHaveBeenCalledWith(2);
});

test('reveal mode marks the correct answer and the player’s pick without buttons', () => {
  render(<AnswerGrid mode="reveal" choices={['A1', 'B1', 'C1', 'D1']} correctIndex={1} selectedIndex={3} counts={[1, 2, 0, 1]} />);
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(screen.getByText('Correct')).toBeInTheDocument();
  expect(screen.getByText('Your answer')).toBeInTheDocument();
  expect(screen.getByText('2 players · 50%')).toBeInTheDocument();
});

test('snapshots restore the locked answer after a reconnect and switch phases cleanly', () => {
  const question = { roundId: 'r1', questionEndsAt: 1, serverTime: 1 };
  const inQuestion = applySnapshot(INITIAL_GAME_STATE, { session: { sessionId: 'X' }, phase: 'question', question, yourAnswerIndex: 2, answeredCount: 4 });
  expect(inQuestion.myAnswer).toEqual({ roundId: 'r1', index: 2, status: 'locked' });
  expect(inQuestion.progress.answeredCount).toBe(4);

  const pending = { ...INITIAL_GAME_STATE, myAnswer: { roundId: 'r1', index: 1, status: 'failed' } };
  expect(applySnapshot(pending, { session: {}, phase: 'question', question, yourAnswerIndex: null }).myAnswer.status).toBe('failed');

  const results = applySnapshot(inQuestion, { session: {}, phase: 'results', results: { roundId: 'r1' }, roundResult: { correct: true } });
  expect(results.question).toBeNull();
  expect(results.results.roundId).toBe('r1');
  expect(results.myAnswer).toBeNull();
});

test('join payload includes saved seat tokens only when present', () => {
  expect(buildJoinPayload({ sessionId: 'ABCDE23456', username: 'Mari' })).toEqual({ sessionId: 'ABCDE23456', username: 'Mari' });
  expect(
    buildJoinPayload({ sessionId: 'ABCDE23456', username: 'Mari', saved: { playerToken: 'p-token-1', hostToken: 'h-token-1' } })
  ).toEqual({ sessionId: 'ABCDE23456', username: 'Mari', playerToken: 'p-token-1', hostToken: 'h-token-1' });
});

test('ordinals', () => {
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
});

// ---------------------------------------------------------------- billing

test('plans describe renewal and expiry in plain language', () => {
  expect(describePlan(PLANS[0])).toMatchObject({ price: '€5', headline: '20 AI games' });
  expect(describePlan(PLANS[0]).terms.join(' ')).toMatch(/12 months/);
  expect(describePlan(PLANS[1]).terms.join(' ')).toMatch(/Renews monthly until you cancel/);
  expect(formatMoney(1250)).toBe('€12.50');
});

test('subscription status tells the customer what happens next', () => {
  const base = { planId: 'plus_monthly', currentPeriodEnd: '2026-10-26T00:00:00Z' };
  expect(describeSubscription({ ...base, status: 'active' }).text).toBe('Active — renews on 26 October 2026.');
  expect(describeSubscription({ ...base, status: 'active', cancelAtPeriodEnd: true }).text).toMatch(/won’t be charged again/);
  expect(describeSubscription({ ...base, status: 'past_due' }).tone).toBe('danger');
  expect(describeSubscription(null)).toBeNull();
});

test('allowance copy', () => {
  expect(describeAllowance({ freeRemainingThisMonth: 2, credits: 5 }).text).toBe('AI games left: 2 free this month + 5 purchased. Free games are used first.');
  expect(describeAllowance({ freeRemainingThisMonth: 0, credits: 0 }).empty).toBe(true);
});

// ------------------------------------------------------------ design tokens

function luminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('text colour tokens meet WCAG AA contrast in light and dark themes', () => {
  const l = LIGHT_COLORS;
  const d = { ...LIGHT_COLORS, ...DARK_COLORS };
  const pairs = [
    ['ink', 'paper'], ['ink-2', 'paper'], ['ink-3', 'paper'], ['ink-3', 'surface'], ['ink-3', 'surface-sunk'],
    ['accent-ink', 'accent'], ['accent', 'paper'], ['success', 'paper'], ['danger', 'paper'], ['warning', 'paper'],
    ['danger', 'danger-soft'], ['success', 'success-soft'], ['warning', 'warning-soft'],
  ];
  for (const theme of [l, d]) {
    for (const [fg, bg] of pairs) {
      expect(contrast(theme[fg], theme[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  }
  for (const answer of ['answer-a', 'answer-b', 'answer-c', 'answer-d']) {
    expect(contrast('#FFFFFF', l[answer]), answer).toBeGreaterThanOrEqual(4.5);
  }
});

// ------------------------------------------------------- kept from before

test('support email falls back to the kazoot address and respects env override', () => {
  expect(getSupportEmail({})).toBe('support@kazoot.app');
  expect(getSupportEmail({ VITE_SUPPORT_EMAIL: ' help@example.com ' })).toBe('help@example.com');
});

test('stale initial auth session cannot overwrite a newer signed-in event', () => {
  const signedIn = { access_token: 'access-token', user: { id: 'user-1' } };
  const state = reduceAuthSessionState(INITIAL_AUTH_STATE, { type: 'auth-event', event: 'SIGNED_IN', session: signedIn });
  const stale = reduceAuthSessionState(state, { type: 'initial-session', session: null });
  expect(stale.session).toBe(signedIn);
});

test('oauth redirect returns to the page the user started from', () => {
  expect(getOAuthRedirectTo({ origin: 'https://kazoot.app', pathname: '/' })).toBe('https://kazoot.app/account');
  expect(getOAuthRedirectTo({ origin: 'https://kazoot.app', pathname: '/create' })).toBe('https://kazoot.app/create');
});

test('host preferences validate values and keep accounts separate without raw ids', async () => {
  expect(normalizeHostPreferences({ language: 'Secret', questionTimeLimitMs: '99999', revealTiming: 'instant' })).toEqual(DEFAULT_HOST_PREFERENCES);
  expect(normalizeHostPreferences({ language: 'Estonian', questionTimeLimitMs: '30000', revealTiming: 'all_answered' }).questionTimeLimitMs).toBe('30000');
  const rawUserId = '00000000-0000-4000-8000-000000000123';
  expect(await getHostPreferencesStorageKey(rawUserId)).not.toContain(rawUserId);
  await saveHostPreferences(null, { language: 'Estonian', questionTimeLimitMs: '10000', revealTiming: 'timer' });
  await saveHostPreferences(rawUserId, { language: 'English', questionTimeLimitMs: '20000', revealTiming: 'timer' });
  await waitFor(async () => expect((await loadHostPreferences(null)).language).toBe('Estonian'));
  expect((await loadHostPreferences(rawUserId)).language).toBe('English');
});

test('saved seats are scoped by name, clearable, and expire after a game ends', () => {
  savePlayerSession('ABCDE23456', { playerToken: 'token-1', playerId: 'player-1', username: 'Mari' });
  expect(loadPlayerSession('ABCDE23456', { username: 'Mari' })?.playerToken).toBe('token-1');
  expect(loadPlayerSession('ABCDE23456', { username: 'Someone Else' })).toBeNull();
  markPlayerSessionEnded('ABCDE23456');
  expect(loadPlayerSession('ABCDE23456', { username: 'Mari' }).expiresAt).toBeLessThan(Date.now() + 11 * 60_000);
  clearPlayerSession('ABCDE23456');
  expect(loadPlayerSession('ABCDE23456', { allowUsernameMismatch: true })).toBeNull();
});

test('two players in one browser keep separate seats for the same room', () => {
  savePlayerSession('ABCDE23456', { playerToken: 'host-token-seat', hostToken: 'h', username: 'Hanna' });
  savePlayerSession('ABCDE23456', { playerToken: 'player-seat', username: 'Mart' });
  expect(loadPlayerSession('ABCDE23456', { username: 'Hanna' }).hostToken).toBe('h');
  expect(loadPlayerSession('ABCDE23456', { username: 'mart' }).playerToken).toBe('player-seat');
  expect(loadPlayerSession('ABCDE23456', { allowUsernameMismatch: true }).username).toBe('Mart');
});
