import { useEffect } from 'react';

// Keeps the screen on while `active` (phones otherwise dim and lock in the lobby and
// between questions). The lock is released by the browser when the page is hidden, so
// it is re-acquired on visibilitychange. Unsupported browsers: nothing happens.
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.wakeLock?.request) return undefined;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) lock.release().catch(() => {});
      } catch {
        // Denied (battery saver, permissions policy): the game works without it.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      lock?.release?.().catch(() => {});
    };
  }, [active]);
}
