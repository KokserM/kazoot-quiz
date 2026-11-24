import React from 'react';
import axe from 'axe-core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AuthProvider } from './auth/AuthProvider';
import { SiteFooter, SiteHeader } from './components/SiteChrome';

beforeEach(() => {
  navigator.sendBeacon = vi.fn(() => true);
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  document.documentElement.setAttribute('data-theme', 'dark');
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

function chrome() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <SiteHeader />
        <main>
          <p>Page</p>
        </main>
        <SiteFooter />
      </MemoryRouter>
    </AuthProvider>
  );
}

test('phone menu is a disclosure: opens with focus on the first row, closes on Escape and outside presses', () => {
  chrome();
  const button = screen.getByRole('button', { name: 'Menu' });
  const panel = document.getElementById('site-menu');
  expect(button).toHaveAttribute('aria-controls', 'site-menu');
  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(panel).not.toBeVisible();

  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(panel).toBeVisible();
  const rows = within(panel).getAllByRole('link');
  expect(rows.map((row) => row.textContent)).toEqual(['How it works', 'Pricing', 'Try a free demo', 'Create a quiz']);
  expect(rows[0]).toHaveFocus();

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(button).toHaveFocus();

  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  fireEvent.pointerDown(screen.getByText('Page'));
  expect(button).toHaveAttribute('aria-expanded', 'false');

  fireEvent.click(button);
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'false');
});

test('header with the menu open has no axe violations', async () => {
  const { container } = chrome();
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});

test('footer theme switch defaults to dark and remembers light', () => {
  chrome();
  const group = screen.getByRole('group', { name: 'Theme' });
  expect(within(group).getByRole('radio', { name: 'Dark' })).toBeChecked();
  fireEvent.click(within(group).getByRole('radio', { name: 'Light' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  expect(localStorage.getItem('kazoot:theme')).toBe('light');
  fireEvent.click(within(group).getByRole('radio', { name: 'Dark' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  expect(localStorage.getItem('kazoot:theme')).toBeNull();
});

test('footer links and the support address stay in the footer, the address of the seller never does', () => {
  const { container } = chrome();
  const legalNav = screen.getByRole('navigation', { name: 'Legal' });
  expect(within(legalNav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Pricing', 'Terms', 'Privacy', 'Refunds & cancellation', 'Contact']);
  expect(container.querySelector('footer')).not.toHaveTextContent('reg. code');
});
