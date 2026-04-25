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

async function request(path, options = {}) {
  const { accessToken, ...fetchOptions } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(fetchOptions.headers || {}),
    },
    ...fetchOptions,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export function createSession(payload, accessToken = null) {
  return request('/api/create-session', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(payload),
  });
}

export function fetchDemoTopics() {
  return request('/api/demo-topics');
}

export function fetchUsage(accessToken) {
  return request('/api/me/usage', {
    accessToken,
  });
}

export function fetchBillingCatalog() {
  return request('/api/billing/catalog');
}

export function createCheckoutSession(planId, accessToken) {
  return request('/api/billing/create-checkout-session', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({ planId }),
  });
}
