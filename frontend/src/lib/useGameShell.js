import { useLayoutEffect, useSyncExternalStore } from 'react';
import { THEME_COLOR } from '../styles/tokens';

// Whether a (non-preview) game shell is mounted. App's Layout reads it to drop the site
// header and footer; the shell itself registers here and owns the document-level
// side effects: <html data-game-shell="true"> (no document scroll, GlobalStyle) and the
// browser UI colour set to the stage colour (also in the light site theme).
let mountedCount = 0;
let savedThemeColor = null;
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => mountedCount > 0;
const getServerSnapshot = () => false;

export function useGameShellMounted() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useRegisterGameShell(active) {
  useLayoutEffect(() => {
    if (!active) return undefined;
    mountedCount += 1;
    if (mountedCount === 1) {
      const root = document.documentElement;
      root.setAttribute('data-game-shell', 'true');
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        savedThemeColor = meta.getAttribute('content');
        meta.setAttribute('content', THEME_COLOR.dark);
      }
    }
    emit();
    return () => {
      mountedCount = Math.max(0, mountedCount - 1);
      if (mountedCount === 0) {
        document.documentElement.removeAttribute('data-game-shell');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta && savedThemeColor) meta.setAttribute('content', savedThemeColor);
        savedThemeColor = null;
      }
      emit();
    };
  }, [active]);
}
