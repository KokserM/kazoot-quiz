export function getBackendUrl() {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  return 'http://localhost:5000';
}

const API_BASE = getBackendUrl();

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'network_error' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { accessToken, hostToken, body, method = body === undefined ? 'GET' : 'POST', timeoutMs = 20_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(hostToken ? { 'X-Host-Token': hostToken } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiError(
      error.name === 'AbortError'
        ? 'The request took too long. Check your connection and try again.'
        : 'Couldn’t reach Kazoot. Check your connection and try again.',
      { code: error.name === 'AbortError' ? 'timeout' : 'network_error' }
    );
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error || 'Something went wrong. Please try again.', { status: response.status, code: data.code });
  }
  return data;
}

export const fetchConfig = () => request('/api/config');
export const fetchUsage = (accessToken) => request('/api/me/usage', { accessToken });
export const fetchBillingCatalog = () => request('/api/billing/catalog');

// AI generation can take a while; allow up to two minutes.
export const createSession = (payload, accessToken = null) =>
  request('/api/create-session', { body: payload, accessToken, timeoutMs: payload.demoId ? 20_000 : 120_000 });

export const createNextSession = (sourceSessionId, payload, accessToken = null) =>
  request(`/api/sessions/${encodeURIComponent(sourceSessionId)}/next`, { body: payload, accessToken, timeoutMs: payload.demoId ? 20_000 : 120_000 });

export const fetchReviewQuestions = (sessionId, hostToken) => request(`/api/sessions/${encodeURIComponent(sessionId)}/review`, { hostToken });
export const saveReviewQuestions = (sessionId, hostToken, questions) =>
  request(`/api/sessions/${encodeURIComponent(sessionId)}/review`, { method: 'PUT', hostToken, body: { questions } });

export const createCheckoutSession = (planId, accessToken) =>
  request('/api/billing/checkout', { accessToken, body: { planId, acceptedImmediateSupply: true } });
export const createPortalSession = (accessToken) => request('/api/billing/portal', { accessToken, body: {} });
export const deleteAccount = (accessToken) => request('/api/me', { method: 'DELETE', accessToken });

export function postBeacon(path, payload) {
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${API_BASE}${path}`, new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {
    // Metrics must never break the app.
  }
}
