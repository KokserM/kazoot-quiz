class FixedWindowRateLimiter {
  constructor({ limit, windowMs }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.buckets = new Map();
  }

  consume(key, amount = 1) {
    if (!this.limit || this.limit <= 0) {
      return { allowed: true, remaining: Infinity };
    }

    const now = Date.now();
    const existing = this.buckets.get(key);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : {
            count: 0,
            resetAt: now + this.windowMs,
          };

    bucket.count += amount;
    this.buckets.set(key, bucket);

    if (bucket.count > this.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: bucket.resetAt,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, this.limit - bucket.count),
      resetAt: bucket.resetAt,
    };
  }

  prune() {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

module.exports = {
  FixedWindowRateLimiter,
};
