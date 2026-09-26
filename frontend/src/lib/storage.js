// Saved seats let a player (or the host) reload, switch apps, or lose signal and
// come back to the same place. Stored per room *and* name, because two tabs in
// one browser (a teacher testing, a shared family laptop) share this storage.
const STORAGE_PREFIX = 'kazoot:player';
const PLAYER_SESSION_TTL_MS = 1000 * 60 * 60 * 6;
const ENDED_PLAYER_SESSION_TTL_MS = 1000 * 60 * 10;

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function seatKey(sessionId, username) {
  return `${STORAGE_PREFIX}:${sessionId.toUpperCase()}:${normalizeUsername(username)}`;
}

function lastKey(sessionId) {
  return `${STORAGE_PREFIX}:${sessionId.toUpperCase()}`;
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (payload?.expiresAt && payload.expiresAt <= Date.now()) {
      localStorage.removeItem(key);
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: reconnecting won't work, playing still does.
  }
}

export function savePlayerSession(sessionId, payload) {
  const now = Date.now();
  const seat = {
    ...payload,
    sessionId: sessionId.toUpperCase(),
    savedAt: payload.savedAt || now,
    lastUsedAt: now,
    expiresAt: payload.expiresAt || now + PLAYER_SESSION_TTL_MS,
  };
  write(seatKey(sessionId, payload.username), seat);
  write(lastKey(sessionId), { username: payload.username, expiresAt: seat.expiresAt });
}

// With a username: that player's seat. Without (or allowUsernameMismatch): the
// seat most recently used in this browser for the room.
export function loadPlayerSession(sessionId, { username = '', allowUsernameMismatch = false } = {}) {
  if (username && !allowUsernameMismatch) {
    return read(seatKey(sessionId, username));
  }
  const last = read(lastKey(sessionId));
  return last ? read(seatKey(sessionId, last.username)) : null;
}

export function clearPlayerSession(sessionId, username = null) {
  try {
    const target = username ?? read(lastKey(sessionId))?.username;
    if (target !== undefined && target !== null) {
      localStorage.removeItem(seatKey(sessionId, target));
    }
    localStorage.removeItem(lastKey(sessionId));
  } catch {
    // ignore
  }
}

export function markPlayerSessionEnded(sessionId) {
  const payload = loadPlayerSession(sessionId, { allowUsernameMismatch: true });
  if (!payload) return;
  savePlayerSession(sessionId, {
    ...payload,
    gameEndedAt: Date.now(),
    expiresAt: Date.now() + ENDED_PLAYER_SESSION_TTL_MS,
  });
}
