import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import App, {
  getRemainingQuestionMs,
  getSessionPhase,
  shouldAttemptQuestionResync,
  shouldShowSessionJoinLoading,
} from './App';

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
