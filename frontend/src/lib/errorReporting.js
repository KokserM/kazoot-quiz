import { postBeacon } from './api';

// Sends uncaught browser errors to the server log (no user data, max 5 per page).
let sent = 0;

function report(message, stack) {
  if (sent >= 5 || !message) return;
  sent += 1;
  postBeacon('/api/client-errors', {
    message: String(message).slice(0, 300),
    stack: String(stack || '').slice(0, 1500),
    path: window.location.pathname,
    release: import.meta.env.VITE_RELEASE || '',
  });
}

export function installErrorReporting() {
  if (!import.meta.env.PROD) return;
  window.addEventListener('error', (event) => report(event.message, event.error?.stack));
  window.addEventListener('unhandledrejection', (event) => report(event.reason?.message || String(event.reason), event.reason?.stack));
}

export { report as reportClientError };
