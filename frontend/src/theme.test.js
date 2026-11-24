import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { applyTheme, getStoredTheme, getTheme, setTheme, THEME_STORAGE_KEY } from './lib/theme';

const initScript = readFileSync(resolve(process.cwd(), 'public/theme-init.js'), 'utf8');
const runInitScript = () => new Function(initScript)();

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-lite');
  document.head.innerHTML = '<meta name="theme-color" content="#000000" />';
});
afterEach(() => localStorage.clear());

const themeColor = () => document.querySelector('meta[name="theme-color"]').getAttribute('content');

test('default theme is dark without a stored preference', () => {
  expect(getStoredTheme()).toBe('dark');
  expect(getTheme()).toBe('dark');
  runInitScript();
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  expect(themeColor()).toBe('#100A1C');
});

test('light is an opt-in that is remembered, and dark clears the preference', () => {
  setTheme('light');
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  expect(themeColor()).toBe('#F8F7FC');

  // A fresh page load restores it before React runs.
  document.documentElement.removeAttribute('data-theme');
  runInitScript();
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  expect(themeColor()).toBe('#F8F7FC');

  setTheme('dark');
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  expect(getTheme()).toBe('dark');
  expect(themeColor()).toBe('#100A1C');
});

test('unknown values fall back to dark', () => {
  localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
  expect(getStoredTheme()).toBe('dark');
  expect(applyTheme('sepia')).toBe('dark');
});

test('the init script stays small and has no dependencies', () => {
  expect(initScript.length).toBeLessThanOrEqual(400);
  expect(initScript).not.toMatch(/import|require\(/);
});
