const HOST_PREFERENCES_SALT_KEY = 'kazoot:hostPreferences:salt';
const HOST_PREFERENCES_ANONYMOUS_KEY = 'kazoot:hostPreferences:anonymous';
const HOST_PREFERENCES_USER_PREFIX = 'kazoot:hostPreferences:user:';

export const HOST_PREFERENCE_OPTIONS = {
  languages: ['English', 'Estonian'],
  questionTimeLimitMs: ['5000', '10000', '15000', '20000'],
  revealTiming: ['timer', 'all_answered'],
};

export const DEFAULT_HOST_PREFERENCES = {
  language: 'English',
  questionTimeLimitMs: '20000',
  revealTiming: 'timer',
};

function isAllowedValue(value, allowedValues) {
  return typeof value === 'string' && allowedValues.includes(value);
}

export function normalizeHostPreferences(preferences = {}) {
  return {
    language: isAllowedValue(preferences.language, HOST_PREFERENCE_OPTIONS.languages)
      ? preferences.language
      : DEFAULT_HOST_PREFERENCES.language,
    questionTimeLimitMs: isAllowedValue(
      preferences.questionTimeLimitMs,
      HOST_PREFERENCE_OPTIONS.questionTimeLimitMs
    )
      ? preferences.questionTimeLimitMs
      : DEFAULT_HOST_PREFERENCES.questionTimeLimitMs,
    revealTiming: isAllowedValue(preferences.revealTiming, HOST_PREFERENCE_OPTIONS.revealTiming)
      ? preferences.revealTiming
      : DEFAULT_HOST_PREFERENCES.revealTiming,
  };
}

function getDefaultStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function getDefaultCrypto() {
  return typeof globalThis === 'undefined' ? null : globalThis.crypto;
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getOrCreateSalt(storage, cryptoProvider) {
  const existingSalt = storage.getItem(HOST_PREFERENCES_SALT_KEY);
  if (existingSalt) {
    return existingSalt;
  }

  const saltBytes = new Uint8Array(16);
  cryptoProvider.getRandomValues(saltBytes);
  const nextSalt = bytesToHex(saltBytes);
  storage.setItem(HOST_PREFERENCES_SALT_KEY, nextSalt);
  return nextSalt;
}

async function getOpaqueUserKeySuffix(userId, { storage, cryptoProvider }) {
  if (
    !userId ||
    !storage ||
    !cryptoProvider?.subtle ||
    typeof cryptoProvider.getRandomValues !== 'function' ||
    typeof TextEncoder === 'undefined'
  ) {
    return null;
  }

  try {
    const salt = getOrCreateSalt(storage, cryptoProvider);
    const payload = new TextEncoder().encode(`${salt}:${userId}`);
    const digest = await cryptoProvider.subtle.digest('SHA-256', payload);
    return bytesToHex(new Uint8Array(digest)).slice(0, 32);
  } catch (error) {
    return null;
  }
}

export async function getHostPreferencesStorageKey(
  userId,
  { storage = getDefaultStorage(), cryptoProvider = getDefaultCrypto() } = {}
) {
  const opaqueUserKey = await getOpaqueUserKeySuffix(userId, { storage, cryptoProvider });
  return opaqueUserKey ? `${HOST_PREFERENCES_USER_PREFIX}${opaqueUserKey}` : HOST_PREFERENCES_ANONYMOUS_KEY;
}

export async function loadHostPreferences(userId, options = {}) {
  const storage = options.storage || getDefaultStorage();
  if (!storage) {
    return DEFAULT_HOST_PREFERENCES;
  }

  try {
    const key = await getHostPreferencesStorageKey(userId, { ...options, storage });
    const rawPreferences = storage.getItem(key);
    if (!rawPreferences) {
      return DEFAULT_HOST_PREFERENCES;
    }

    return normalizeHostPreferences(JSON.parse(rawPreferences));
  } catch (error) {
    return DEFAULT_HOST_PREFERENCES;
  }
}

export async function saveHostPreferences(userId, preferences, options = {}) {
  const storage = options.storage || getDefaultStorage();
  if (!storage) {
    return;
  }

  try {
    const key = await getHostPreferencesStorageKey(userId, { ...options, storage });
    storage.setItem(key, JSON.stringify(normalizeHostPreferences(preferences)));
  } catch (error) {
    // Preference persistence should never block hosting a game.
  }
}
