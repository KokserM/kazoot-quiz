const STORAGE_PREFIX = 'kazoot:player';

function buildKey(sessionId) {
  return `${STORAGE_PREFIX}:${sessionId.toUpperCase()}`;
}

export function savePlayerSession(sessionId, payload) {
  localStorage.setItem(buildKey(sessionId), JSON.stringify(payload));
}

export function loadPlayerSession(sessionId) {
  const raw = localStorage.getItem(buildKey(sessionId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    localStorage.removeItem(buildKey(sessionId));
    return null;
  }
}

export function clearPlayerSession(sessionId) {
  localStorage.removeItem(buildKey(sessionId));
}
