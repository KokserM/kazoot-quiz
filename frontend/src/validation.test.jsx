import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AuthProvider } from './auth/AuthProvider';
import DemoPage from './pages/DemoPage';
import JoinPage from './pages/JoinPage';
import { NameForm } from './pages/SessionPage';

// Validation pattern (brief 5.1): submit buttons stay enabled; on press the first
// invalid field gets focus and its error; a submitted name is remembered.

beforeEach(() => {
  navigator.sendBeacon = vi.fn(() => true);
  globalThis.fetch = vi.fn(async (url) => ({
    ok: true,
    json: async () =>
      String(url).includes('/api/config')
        ? { aiAvailable: true, freeAiGamesPerMonth: 3, maxPlayersPerRoom: 150, maxDemoPlayers: 30, demoQuizzes: [{ id: 'warm-up', title: 'Quick warm-up', description: 'x', language: 'English' }] }
        : { sessionId: 'ABCDE23456', hostToken: 'h' },
  }));
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderAt(path, element, routePath = path) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="/session/:sessionId" element={<p>In the room</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

test('join: the button is enabled and explains a bad code, then an empty name, on press', async () => {
  renderAt('/join', <JoinPage />);
  const button = screen.getByRole('button', { name: 'Join game' });
  const code = screen.getByLabelText('Room code');
  const name = screen.getByLabelText('Your name');
  expect(button).toBeEnabled();

  fireEvent.click(button);
  expect(screen.getAllByRole('alert').map((alert) => alert.textContent)).toEqual(['Room codes have 10 letters and numbers.', 'Enter a name.']);
  expect(code).toHaveFocus();
  expect(code).toHaveAttribute('aria-invalid', 'true');

  fireEvent.change(code, { target: { value: 'abcde 23456' } });
  fireEvent.click(button);
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a name.');
  expect(name).toHaveFocus();

  fireEvent.change(name, { target: { value: ' Mari ' } });
  fireEvent.click(button);
  expect(await screen.findByText('In the room')).toBeInTheDocument();
  expect(localStorage.getItem('kazoot:last-name')).toBe('Mari');
});

test('demo: the start button is enabled and asks for a name on press', async () => {
  renderAt('/demo', <DemoPage />);
  const button = await screen.findByRole('button', { name: 'Create demo room' });
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a name.');
  expect(screen.getByLabelText('Your name')).toHaveFocus();
  expect(globalThis.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/create-session'), expect.anything());

  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Hanna' } });
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.click(button);
  expect(await screen.findByText('In the room')).toBeInTheDocument();
  expect(localStorage.getItem('kazoot:last-name')).toBe('Hanna');
});

test('session name form: the button is enabled and asks for a name on press', () => {
  const onJoin = vi.fn();
  render(
    <MemoryRouter>
      <NameForm code="ABCDE23456" saved={null} onJoin={onJoin} />
    </MemoryRouter>
  );
  const button = screen.getByRole('button', { name: 'Join game' });
  expect(button).toBeEnabled();
  fireEvent.click(button);
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a name.');
  expect(screen.getByLabelText('Your name')).toHaveFocus();
  expect(onJoin).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Mart' } });
  fireEvent.click(button);
  expect(onJoin).toHaveBeenCalledWith('Mart', true);
});
