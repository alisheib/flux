/**
 * Simple in-memory rate limiter for API routes.
 * Tracks attempts per key (IP or email) with sliding window.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

export function rateLimit(
  key: string,
  opts: { maxAttempts: number; windowMs: number } = { maxAttempts: 5, windowMs: 15 * 60 * 1000 }
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, remaining: opts.maxAttempts - 1, resetIn: opts.windowMs };
  }

  entry.count++;

  if (entry.count > opts.maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetAt - now,
    };
  }

  return {
    allowed: true,
    remaining: opts.maxAttempts - entry.count,
    resetIn: entry.resetAt - now,
  };
}
