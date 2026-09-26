import { postBeacon } from './api';

// Anonymous funnel events: event name plus a few non-identifying properties.
// No cookies, no identifiers, no third parties.
const onceKeys = new Set();

export function track(name, props = {}, { oncePerSession = false } = {}) {
  if (oncePerSession) {
    try {
      const key = `kazoot:tracked:${name}`;
      if (sessionStorage.getItem(key) || onceKeys.has(key)) return;
      sessionStorage.setItem(key, '1');
      onceKeys.add(key);
    } catch {
      if (onceKeys.has(name)) return;
      onceKeys.add(name);
    }
  }
  postBeacon('/api/events', { name, props });
}
