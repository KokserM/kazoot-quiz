const STORAGE_PREFIX = 'kazoot:player';
const PLAYER_SESSION_TTL_MS = 1000 * 60 * 60 * 6;
const ENDED_PLAYER_SESSION_TTL_MS = 1000 * 60 * 10;

function buildKey(sessionId) {
  return `${STORAGE_PREFIX}:${sessionId.toUpperCase()}`;
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function isExpired(payload, now = Date.now()) {
  return Boolean(payload?.expiresAt && payload.expiresAt <= now);
}

export function savePlayerSession(sessionId, payload) {
  const now = Date.now();
  localStorage.setItem(
    buildKey(sessionId),
    JSON.stringify({
      ...payload,
      sessionId: sessionId.toUpperCase(),
      savedAt: payload.savedAt || now,
      lastUsedAt: now,
      expiresAt: payload.expiresAt || now + PLAYER_SESSION_TTL_MS,
    })
  );
}

export function loadPlayerSession(sessionId, { username = '', allowUsernameMismatch = false } = {}) {
  const key = buildKey(sessionId);
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const payload = JSON.parse(raw);
    if (isExpired(payload)) {
      localStorage.removeItem(key);
      return null;
    }

    if (
      username &&
      !allowUsernameMismatch &&
      payload.username &&
      normalizeUsername(payload.username) !== normalizeUsername(username)
    ) {
      return null;
    }

    return payload;
  } catch (error) {
    localStorage.removeItem(key);
    return null;
  }
}

export function clearPlayerSession(sessionId) {
  localStorage.removeItem(buildKey(sessionId));
}

export function markPlayerSessionEnded(sessionId) {
  const payload = loadPlayerSession(sessionId, { allowUsernameMismatch: true });
  if (!payload) {
    return;
  }

  savePlayerSession(sessionId, {
    ...payload,
    gameEndedAt: Date.now(),
    expiresAt: Date.now() + ENDED_PLAYER_SESSION_TTL_MS,
  });
}
