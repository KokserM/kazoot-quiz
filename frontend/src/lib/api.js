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
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export function createSession(payload) {
  return request('/api/create-session', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchDemoTopics() {
  return request('/api/demo-topics');
}
