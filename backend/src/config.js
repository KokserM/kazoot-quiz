const { URL } = require('url');
require('dotenv').config();

const DEFAULT_PORT = 5000;
const DEFAULT_QUESTION_TIME_LIMIT_MS = 20000;
const DEFAULT_SESSION_RETENTION_MS = 1000 * 60 * 30;
const DEFAULT_ENDED_SESSION_RETENTION_MS = 1000 * 60 * 10;
const DEFAULT_MAX_ACTIVE_SESSIONS = 500;
const DEFAULT_MAX_PLAYERS_PER_SESSION = 250;
const DEFAULT_MAX_CONNECTED_PLAYERS = 5000;
const DEFAULT_DEGRADED_ACTIVE_SESSIONS = 400;
const DEFAULT_DEGRADED_CONNECTED_PLAYERS = 4000;
const DEFAULT_DEGRADED_HEAP_USED_MB = 384;
const DEFAULT_SOCKET_PING_INTERVAL_MS = 25000;
const DEFAULT_SOCKET_PING_TIMEOUT_MS = 30000;
const DEFAULT_SOCKET_MAX_HTTP_BUFFER_SIZE = 1000000;
const DEFAULT_FREE_AI_GAMES_PER_DAY = 3;
const DEFAULT_AI_CREDIT_COST_PER_QUIZ = 1;
const DEFAULT_DAILY_OPENAI_BUDGET_USD = 10;
const DEFAULT_MONTHLY_OPENAI_BUDGET_USD = 100;
const DEFAULT_MAX_AI_GENERATIONS_PER_USER_PER_HOUR = 5;
const DEFAULT_MAX_AI_GENERATIONS_PER_IP_PER_HOUR = 10;
const DEFAULT_OPENAI_EST_INPUT_COST_PER_1M = 2.5;
const DEFAULT_OPENAI_EST_OUTPUT_COST_PER_1M = 15;
const DEFAULT_CREATE_SESSION_RATE_LIMIT_PER_15_MIN = 20;
const DEFAULT_JOIN_RATE_LIMIT_PER_MIN = 30;
const DEFAULT_FAILED_JOIN_RATE_LIMIT_PER_15_MIN = 20;
const DEFAULT_SOCKET_EVENT_RATE_LIMIT_PER_10_SEC = 80;

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

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toHttpsOrigin(value) {
  if (!value) {
    return '';
  }

  return value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;
}

function buildAllowedOrigins(frontendUrl, originAliases = []) {
  const allowed = new Set();

  for (const origin of [frontendUrl, ...originAliases]) {
    const normalized = normalizeOrigin(origin);
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
const corsAllowedOrigins = parseCsv(process.env.CORS_ALLOWED_ORIGINS);
const railwayPublicOrigin = toHttpsOrigin(process.env.RAILWAY_PUBLIC_DOMAIN || '');

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toNumber(process.env.PORT, DEFAULT_PORT),
  host: process.env.HOST || '0.0.0.0',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  frontendUrl,
  allowedOrigins: buildAllowedOrigins(frontendUrl, [railwayPublicOrigin, ...corsAllowedOrigins]),
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
  maxActiveSessions: toNumber(process.env.MAX_ACTIVE_SESSIONS, DEFAULT_MAX_ACTIVE_SESSIONS),
  maxPlayersPerSession: toNumber(
    process.env.MAX_PLAYERS_PER_SESSION,
    DEFAULT_MAX_PLAYERS_PER_SESSION
  ),
  maxConnectedPlayers: toNumber(
    process.env.MAX_CONNECTED_PLAYERS,
    DEFAULT_MAX_CONNECTED_PLAYERS
  ),
  degradedActiveSessions: toNumber(
    process.env.DEGRADED_ACTIVE_SESSIONS,
    DEFAULT_DEGRADED_ACTIVE_SESSIONS
  ),
  degradedConnectedPlayers: toNumber(
    process.env.DEGRADED_CONNECTED_PLAYERS,
    DEFAULT_DEGRADED_CONNECTED_PLAYERS
  ),
  degradedHeapUsedMb: toNumber(
    process.env.DEGRADED_HEAP_USED_MB,
    DEFAULT_DEGRADED_HEAP_USED_MB
  ),
  socketPingIntervalMs: toNumber(
    process.env.SOCKET_PING_INTERVAL_MS,
    DEFAULT_SOCKET_PING_INTERVAL_MS
  ),
  socketPingTimeoutMs: toNumber(
    process.env.SOCKET_PING_TIMEOUT_MS,
    DEFAULT_SOCKET_PING_TIMEOUT_MS
  ),
  socketMaxHttpBufferSize: toNumber(
    process.env.SOCKET_MAX_HTTP_BUFFER_SIZE,
    DEFAULT_SOCKET_MAX_HTTP_BUFFER_SIZE
  ),
  openAiModel: process.env.OPENAI_MODEL || 'gpt-5.4',
  aiModelFreeTier: process.env.AI_MODEL_FREE_TIER || process.env.OPENAI_MODEL || 'gpt-5.4',
  aiModelPaidTier: process.env.AI_MODEL_PAID_TIER || process.env.OPENAI_MODEL || 'gpt-5.4',
  freeAiGamesPerDay: toNumber(
    process.env.FREE_AI_GAMES_PER_DAY,
    DEFAULT_FREE_AI_GAMES_PER_DAY
  ),
  aiCreditCostPerQuiz: toNumber(
    process.env.AI_CREDIT_COST_PER_QUIZ,
    DEFAULT_AI_CREDIT_COST_PER_QUIZ
  ),
  dailyOpenAiBudgetUsd: toNumber(
    process.env.DAILY_OPENAI_BUDGET_USD,
    DEFAULT_DAILY_OPENAI_BUDGET_USD
  ),
  monthlyOpenAiBudgetUsd: toNumber(
    process.env.MONTHLY_OPENAI_BUDGET_USD,
    DEFAULT_MONTHLY_OPENAI_BUDGET_USD
  ),
  maxAiGenerationsPerUserPerHour: toNumber(
    process.env.MAX_AI_GENERATIONS_PER_USER_PER_HOUR,
    DEFAULT_MAX_AI_GENERATIONS_PER_USER_PER_HOUR
  ),
  maxAiGenerationsPerIpPerHour: toNumber(
    process.env.MAX_AI_GENERATIONS_PER_IP_PER_HOUR,
    DEFAULT_MAX_AI_GENERATIONS_PER_IP_PER_HOUR
  ),
  openAiEstInputCostPer1M: toNumber(
    process.env.OPENAI_EST_INPUT_COST_PER_1M,
    DEFAULT_OPENAI_EST_INPUT_COST_PER_1M
  ),
  openAiEstOutputCostPer1M: toNumber(
    process.env.OPENAI_EST_OUTPUT_COST_PER_1M,
    DEFAULT_OPENAI_EST_OUTPUT_COST_PER_1M
  ),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  stripePlusPriceId: process.env.STRIPE_PLUS_PRICE_ID || '',
  stripeProPriceId: process.env.STRIPE_PRO_PRICE_ID || '',
  stripeCreditPack100PriceId: process.env.STRIPE_CREDIT_PACK_100_PRICE_ID || '',
  stripeCreditPack250PriceId: process.env.STRIPE_CREDIT_PACK_250_PRICE_ID || '',
  billingSuccessUrl: process.env.BILLING_SUCCESS_URL || `${frontendUrl || 'http://localhost:3000'}/account?billing=success`,
  billingCancelUrl: process.env.BILLING_CANCEL_URL || `${frontendUrl || 'http://localhost:3000'}/account?billing=cancelled`,
  trustProxy: process.env.TRUST_PROXY || (process.env.RAILWAY_ENVIRONMENT_ID ? '1' : 'loopback'),
  detailedHealthEnabled: process.env.DETAILED_HEALTH === 'true',
  diagnosticsSecret: process.env.DIAGNOSTICS_SECRET || '',
  createSessionRateLimitPer15Min: toNumber(
    process.env.CREATE_SESSION_RATE_LIMIT_PER_15_MIN,
    DEFAULT_CREATE_SESSION_RATE_LIMIT_PER_15_MIN
  ),
  joinRateLimitPerMin: toNumber(
    process.env.JOIN_RATE_LIMIT_PER_MIN,
    DEFAULT_JOIN_RATE_LIMIT_PER_MIN
  ),
  failedJoinRateLimitPer15Min: toNumber(
    process.env.FAILED_JOIN_RATE_LIMIT_PER_15_MIN,
    DEFAULT_FAILED_JOIN_RATE_LIMIT_PER_15_MIN
  ),
  socketEventRateLimitPer10Sec: toNumber(
    process.env.SOCKET_EVENT_RATE_LIMIT_PER_10_SEC,
    DEFAULT_SOCKET_EVENT_RATE_LIMIT_PER_10_SEC
  ),
  storeMode: 'single-instance-memory',
  railway: {
    projectId: process.env.RAILWAY_PROJECT_ID || '',
    projectName: process.env.RAILWAY_PROJECT_NAME || '',
    environmentId: process.env.RAILWAY_ENVIRONMENT_ID || '',
    environmentName: process.env.RAILWAY_ENVIRONMENT_NAME || '',
    serviceId: process.env.RAILWAY_SERVICE_ID || '',
    serviceName: process.env.RAILWAY_SERVICE_NAME || '',
    deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || '',
    replicaId: process.env.RAILWAY_REPLICA_ID || '',
    replicaRegion: process.env.RAILWAY_REPLICA_REGION || '',
    publicDomain: process.env.RAILWAY_PUBLIC_DOMAIN || '',
  },
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

  return false;
}

module.exports = {
  config,
  isOriginAllowed,
};
