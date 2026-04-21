const { URL } = require('url');
require('dotenv').config();

const DEFAULT_PORT = 5000;
const DEFAULT_QUESTION_TIME_LIMIT_MS = 20000;
const DEFAULT_SESSION_RETENTION_MS = 1000 * 60 * 30;
const DEFAULT_ENDED_SESSION_RETENTION_MS = 1000 * 60 * 10;

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOrigin(origin) {
  if (!origin) {
    return null;
  }

  try {
    return new URL(origin).origin;
  } catch (error) {
    return null;
  }
}

function buildAllowedOrigins(frontendUrl) {
  const allowed = new Set();

  if (frontendUrl) {
    const normalized = normalizeOrigin(frontendUrl);
    if (normalized) {
      allowed.add(normalized);
    }
  }

  return allowed;
}

function isDevelopmentOrigin(origin) {
  return (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('https://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.startsWith('https://127.0.0.1:') ||
    origin.startsWith('http://192.168.') ||
    origin.startsWith('https://192.168.')
  );
}

const frontendUrl = process.env.FRONTEND_URL || '';

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toNumber(process.env.PORT, DEFAULT_PORT),
  host: process.env.HOST || '0.0.0.0',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  frontendUrl,
  allowedOrigins: buildAllowedOrigins(frontendUrl),
  questionTimeLimitMs: toNumber(
    process.env.QUESTION_TIME_LIMIT_MS,
    DEFAULT_QUESTION_TIME_LIMIT_MS
  ),
  sessionRetentionMs: toNumber(
    process.env.SESSION_RETENTION_MS,
    DEFAULT_SESSION_RETENTION_MS
  ),
  endedSessionRetentionMs: toNumber(
    process.env.ENDED_SESSION_RETENTION_MS,
    DEFAULT_ENDED_SESSION_RETENTION_MS
  ),
  openAiModel: process.env.OPENAI_MODEL || 'gpt-5.4',
};

function isOriginAllowed(origin) {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  if (config.nodeEnv !== 'production' && isDevelopmentOrigin(normalizedOrigin)) {
    return true;
  }

  if (config.allowedOrigins.has(normalizedOrigin)) {
    return true;
  }

  try {
    const { hostname, protocol } = new URL(normalizedOrigin);
    if (hostname.endsWith('.railway.app') && protocol === 'https:') {
      return true;
    }
  } catch (error) {
    return false;
  }

  return false;
}

module.exports = {
  config,
  isOriginAllowed,
};
