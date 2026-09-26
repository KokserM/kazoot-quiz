import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const auth = {
  user: { id: 'u1', email: 'host@example.com', user_metadata: { full_name: 'Hanna Tamm' } },
  isAuthLoading: false,
  isConfigured: true,
  accessToken: 'token',
  usage: { freeRemainingThisMonth: 1, credits: 0 },
  refreshUsage: vi.fn(async () => null),
  signIn: vi.fn(),
  authError: '',
};
vi.mock('./auth/AuthProvider', () => ({ useAuth: () => auth }));

const { default: CreatePage } = await import('./pages/CreatePage');

let createResponse;
beforeEach(() => {
  navigator.sendBeacon = vi.fn(() => true);
  globalThis.fetch = vi.fn(async (url, options) => {
    if (String(url).includes('/api/config')) {
      return { ok: true, json: async () => ({ aiAvailable: true, freeAiGamesPerMonth: 3, demoQuizzes: [] }) };
    }
    if (String(url).includes('/api/create-session')) {
      createResponse.request = JSON.parse(options.body);
      return createResponse;
    }
    return { ok: true, json: async () => ({}) };
  });
});
afterEach(cleanup);

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={['/create']}>
      <Routes>
        <Route path="/create" element={<CreatePage />} />
        <Route path="/session/:id" element={<p>In the lobby</p>} />
      </Routes>
    </MemoryRouter>
  );
}

test('signed-in hosts see their allowance and can choose surprise or review mode', async () => {
  renderCreate();
  expect(screen.getByText('AI games left: 1 free this month. Free games are used first.')).toBeInTheDocument();
  expect(screen.getByLabelText('Your name')).toHaveValue('Hanna');
  expect(screen.getByRole('radio', { name: /Surprise me/ })).toBeChecked();
  expect(screen.getByText(/can’t know private details/)).toBeInTheDocument();
});

test('a failed generation keeps the form and says the host was not charged', async () => {
  createResponse = {
    ok: false,
    status: 502,
    json: async () => ({ error: 'We couldn’t create a good enough quiz this time. You were not charged.', code: 'generation_failed' }),
  };
  renderCreate();
  fireEvent.change(screen.getByLabelText(/^Topic/), { target: { value: 'Volcanoes' } });
  fireEvent.click(screen.getByRole('radio', { name: /Let me check first/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Create quiz' }));
  expect(await screen.findByText(/You were not charged/)).toBeInTheDocument();
  expect(screen.getByLabelText(/^Topic/)).toHaveValue('Volcanoes');
  expect(createResponse.request).toMatchObject({ topic: 'Volcanoes', reviewMode: true, difficulty: 'mixed' });
  expect(auth.refreshUsage).toHaveBeenCalled();
});

test('a successful generation goes straight to the lobby', async () => {
  createResponse = { ok: true, json: async () => ({ sessionId: 'ABCDE23456', hostToken: 'h' }) };
  renderCreate();
  fireEvent.change(screen.getByLabelText(/^Topic/), { target: { value: 'Volcanoes' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create quiz' }));
  expect(await screen.findByText('In the lobby')).toBeInTheDocument();
});

test('hosts with no AI games left are pointed to buying more instead of a failing button', () => {
  auth.usage = { freeRemainingThisMonth: 0, credits: 0 };
  renderCreate();
  expect(screen.getByText('You have no AI games left this month.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Get more AI games' })).toHaveAttribute('href', '/account');
  expect(screen.getByRole('button', { name: 'Create quiz' })).toBeDisabled();
  auth.usage = { freeRemainingThisMonth: 1, credits: 0 };
});
