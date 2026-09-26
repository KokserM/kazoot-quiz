import React from 'react';
import axe from 'axe-core';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AuthProvider } from './auth/AuthProvider';
import { AnswerGrid } from './components/game/AnswerGrid';
import { SiteFooter, SiteHeader } from './components/SiteChrome';
import DemoPage from './pages/DemoPage';
import HomePage from './pages/HomePage';
import JoinPage from './pages/JoinPage';
import { PrivacyPage, RefundsPage } from './pages/LegalPages';

beforeEach(() => {
  navigator.sendBeacon = vi.fn(() => true);
  globalThis.fetch = vi.fn(async (url) => ({
    ok: true,
    json: async () =>
      String(url).includes('/api/config')
        ? { aiAvailable: true, freeAiGamesPerMonth: 3, maxPlayersPerRoom: 150, maxDemoPlayers: 30, demoQuizzes: [{ id: 'space', title: 'Space', description: 'd', language: 'English' }] }
        : { plans: [] },
  }));
});
afterEach(cleanup);

async function expectNoViolations(container) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } }, // no layout in jsdom; tokens are tested instead
  });
  const summary = results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
  expect(summary).toEqual([]);
}

function page(element) {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <SiteHeader />
        <Routes>
          <Route path="*" element={element} />
        </Routes>
        <SiteFooter />
      </MemoryRouter>
    </AuthProvider>
  );
}

test('landing page has no axe violations', async () => {
  const { container } = page(<HomePage />);
  await screen.findByText(/Start free/);
  await expectNoViolations(container);
});

test('demo page has no axe violations', async () => {
  const { container } = page(<DemoPage />);
  await screen.findByText('Space');
  await expectNoViolations(container);
});

test('join page has no axe violations', async () => {
  await expectNoViolations(page(<JoinPage />).container);
});

test('legal pages have no axe violations', async () => {
  await expectNoViolations(page(<PrivacyPage />).container);
  cleanup();
  await expectNoViolations(page(<RefundsPage />).container);
});

test('answer grid has no axe violations in both modes', async () => {
  await expectNoViolations(render(<AnswerGrid choices={['a', 'b', 'c', 'd']} onSelect={() => {}} selectedIndex={1} selectionStatus="locked" />).container);
  cleanup();
  await expectNoViolations(render(<AnswerGrid mode="reveal" choices={['a', 'b', 'c', 'd']} correctIndex={0} selectedIndex={1} counts={[1, 1, 0, 0]} />).container);
});
