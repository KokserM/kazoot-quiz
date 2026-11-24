import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const auth = { user: null, isAuthLoading: false, isConfigured: true };
vi.mock('./auth/AuthProvider', () => ({ useAuth: () => auth }));

const { default: DemoPage } = await import('./pages/DemoPage');

let createRequest;
beforeEach(() => {
  createRequest = null;
  navigator.sendBeacon = vi.fn(() => true);
  globalThis.fetch = vi.fn(async (url, options) => {
    if (String(url).includes('/api/config')) {
      return {
        ok: true,
        json: async () => ({
          aiAvailable: true,
          maxDemoPlayers: 30,
          demoQuizzes: [
            { id: 'space', title: 'Space', description: 'Planets and stars', language: 'English' },
            { id: 'eesti', title: 'Eesti', description: 'Estonia', language: 'Estonian' },
          ],
        }),
      };
    }
    if (String(url).includes('/api/create-session')) {
      createRequest = JSON.parse(options.body);
      return { ok: true, json: async () => ({ sessionId: 'ABCDE23456', hostToken: 'h' }) };
    }
    return { ok: true, json: async () => ({}) };
  });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  auth.user = null;
});

function Room() {
  const { state } = useLocation();
  return <p>{`In the room as ${state.username}${state.solo ? ' (solo)' : ''}`}</p>;
}

function renderDemo() {
  return render(
    <MemoryRouter initialEntries={['/demo']}>
      <Routes>
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/session/:sessionId" element={<Room />} />
      </Routes>
    </MemoryRouter>
  );
}

test('a first-time visitor starts a solo preview with one tap, as "Player"', async () => {
  renderDemo();
  // The first quiz is picked by default; no name is asked for solo.
  expect(await screen.findByRole('radio', { name: /Space/ })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Start solo preview' }));
  expect(await screen.findByText('In the room as Player (solo)')).toBeInTheDocument();
  expect(createRequest).toMatchObject({ demoId: 'space', revealTiming: 'all_answered' });
  // A default name is not remembered as the visitor's name.
  expect(localStorage.getItem('kazoot:last-name')).toBeNull();
});

test('solo uses the last name this browser played under, else the signed-in first name', async () => {
  localStorage.setItem('kazoot:last-name', 'Mari');
  renderDemo();
  fireEvent.click(await screen.findByRole('button', { name: 'Start solo preview' }));
  expect(await screen.findByText('In the room as Mari (solo)')).toBeInTheDocument();
  cleanup();
  localStorage.clear();

  auth.user = { id: 'u1', user_metadata: { full_name: 'Hanna Tamm' } };
  renderDemo();
  fireEvent.click(await screen.findByRole('radio', { name: /Eesti/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Start solo preview' }));
  expect(await screen.findByText('In the room as Hanna (solo)')).toBeInTheDocument();
  expect(createRequest).toMatchObject({ demoId: 'eesti', language: 'Estonian' });
});

test('the group room still asks for a name, and the old mode switch is gone', async () => {
  renderDemo();
  const button = await screen.findByRole('button', { name: 'Create demo room' });
  expect(screen.queryByText('How do you want to play?')).toBeNull();
  fireEvent.click(button);
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a name.');
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Kai' } });
  fireEvent.click(button);
  expect(await screen.findByText('In the room as Kai')).toBeInTheDocument();
  expect(createRequest).toMatchObject({ revealTiming: 'timer' });
});
