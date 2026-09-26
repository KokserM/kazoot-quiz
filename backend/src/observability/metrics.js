// Privacy-light product metrics.
// - track(): one row per funnel event (no user id, no IP, only whitelisted props).
// - count(): high-volume counters (reconnects, join failures) rolled up every few
//   minutes into a single 'metrics_rollup' row.
// Failures to record metrics never affect gameplay.

const CLIENT_EVENTS = new Set([
  'landing_view',
  'demo_opened',
  'pricing_viewed',
  'create_opened',
  'checkout_started',
  'end_cta_clicked',
]);

const ALLOWED_PROP_KEYS = new Set([
  'kind',
  'mode',
  'players',
  'questions',
  'code',
  'reason',
  'plan',
  'source',
  'language',
  'demoId',
  'role',
  'completedQuestions',
]);

function cleanProps(props = {}) {
  const cleaned = {};
  for (const [key, value] of Object.entries(props || {})) {
    if (!ALLOWED_PROP_KEYS.has(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) cleaned[key] = value;
    else if (typeof value === 'boolean') cleaned[key] = value;
    else if (typeof value === 'string') cleaned[key] = value.slice(0, 40);
  }
  return cleaned;
}

class Metrics {
  constructor({ sink, logger, flushIntervalMs = 5 * 60_000 }) {
    this.sink = sink;
    this.logger = logger;
    this.counters = {};
    this.flushIntervalMs = flushIntervalMs;
    this.timer = null;
  }

  start() {
    if (this.timer || !this.flushIntervalMs) return;
    this.timer = setInterval(() => this.flush(), this.flushIntervalMs);
    this.timer.unref?.();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  track(name, props = {}) {
    const cleaned = cleanProps(props);
    this.logger.info('metric', { name, ...cleaned });
    Promise.resolve()
      .then(() => this.sink?.(name, cleaned))
      .catch((error) => this.logger.warn('metric_write_failed', { name, message: error.message }));
  }

  count(name, amount = 1) {
    this.counters[name] = (this.counters[name] || 0) + amount;
  }

  async flush() {
    const counters = this.counters;
    this.counters = {};
    if (!Object.keys(counters).length) return;
    this.logger.info('metrics_rollup', counters);
    try {
      await this.sink?.('metrics_rollup', counters);
    } catch (error) {
      this.logger.warn('metric_write_failed', { name: 'metrics_rollup', message: error.message });
    }
  }
}

module.exports = { Metrics, CLIENT_EVENTS, cleanProps };
