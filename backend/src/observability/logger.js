// One JSON object per line on stdout/stderr, which Railway indexes and can filter.
// Never log secrets, tokens, emails, or quiz contents.
const REDACTED_KEYS = /token|secret|password|authorization|apikey|api_key|email|cookie/i;

function sanitize(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return { name: value.name, message: String(value.message).slice(0, 500), code: value.code };
  }
  if (Array.isArray(value)) {
    return depth > 3 ? '[array]' : value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth > 3) return '[object]';
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, REDACTED_KEYS.test(key) ? '[redacted]' : sanitize(entry, depth + 1)])
    );
  }
  if (typeof value === 'string') return value.slice(0, 1000);
  return value;
}

function createLogger({ silent = false, base = {} } = {}) {
  function write(level, event, fields = {}) {
    if (silent) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...base, ...sanitize(fields) });
    if (level === 'error' || level === 'warn') {
      console.error(line);
    } else {
      console.log(line);
    }
  }

  return {
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, fields) => write('error', event, fields),
  };
}

module.exports = { createLogger, sanitize };
