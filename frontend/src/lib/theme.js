import { useCallback, useState } from 'react';
import { THEME_COLOR } from '../styles/tokens';

// Site theme. Dark (the stage palette) is the default for everyone, whatever the OS
// setting; light is an explicit choice remembered in localStorage. The first paint is
// handled by public/theme-init.js (a blocking script in index.html, same key and
// colours), so there is no flash; these helpers keep it in sync afterwards.
export const THEME_STORAGE_KEY = 'kazoot:theme';
export const THEMES = ['dark', 'light'];
export const DEFAULT_THEME = 'dark';

function normalizeTheme(value) {
  return value === 'light' ? 'light' : DEFAULT_THEME;
}

// The remembered choice ('light' or the default 'dark').
export function getStoredTheme() {
  try {
    return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

// The theme the page currently shows (the <html data-theme> attribute, else the stored choice).
export function getTheme() {
  const attribute = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null;
  return attribute ? normalizeTheme(attribute) : getStoredTheme();
}

// Sets <html data-theme> and the browser UI colour. Does not store anything.
export function applyTheme(theme) {
  const next = normalizeTheme(theme);
  if (typeof document === 'undefined') return next;
  document.documentElement.setAttribute('data-theme', next);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[next]);
  return next;
}

// Applies and remembers the choice. Dark is stored as "no preference" (key removed).
export function setTheme(theme) {
  const next = applyTheme(theme);
  try {
    if (next === 'light') localStorage.setItem(THEME_STORAGE_KEY, 'light');
    else localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page view.
  }
  return next;
}

// [theme, setTheme] for controls such as the footer switch.
export function useTheme() {
  const [theme, setState] = useState(getTheme);
  const update = useCallback((value) => setState(setTheme(value)), []);
  return [theme, update];
}
