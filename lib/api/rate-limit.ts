import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Rate limiting.
 *
 * With Upstash configured (recommended on Vercel — serverless instances do not
 * share memory), limits are enforced globally with a sliding window.
 * Without it, an in-process token bucket keeps local development honest and
 * still protects a single-instance deployment.
 */

let upstashLimiter: Ratelimit | null = null;
let upstashConfigured = false;

function getUpstashLimiter(limitPerHour: number): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  if (!upstashConfigured) {
    upstashConfigured = true;
    try {
      upstashLimiter = new Ratelimit({
        redis: new Redis({ url, token }),
        limiter: Ratelimit.slidingWindow(limitPerHour, '1 h'),
        analytics: true,
        prefix: 'm1:rl',
      });
    } catch (error) {
      console.error('[rate-limit] failed to initialise Upstash:', error);
      upstashLimiter = null;
    }
  }
  return upstashLimiter;
}

/* -------------------------------------------------------------------------- */
/*  In-memory fallback                                                        */
/* -------------------------------------------------------------------------- */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function memoryLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const fresh: Bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return { success: true, remaining: limit - 1, reset: fresh.resetAt, limit };
  }

  bucket.count += 1;
  const success = bucket.count <= limit;

  // Opportunistic cleanup so the map cannot grow without bound.
  if (buckets.size > 5_000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }

  return {
    success,
    remaining: Math.max(0, limit - bucket.count),
    reset: bucket.resetAt,
    limit,
  };
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  /** True when the limiter is process-local (no Upstash configured). */
  local: boolean;
}

/**
 * Consume one unit of a named budget for a key (usually the user id).
 * `scope` keeps separate counters for chat / image / admin-test traffic.
 */
export async function consumeRateLimit(
  key: string,
  limitPerWindow: number,
  scope = 'default',
  windowMs = 60 * 60 * 1000,
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(limitPerWindow);

  if (limiter) {
    try {
      const result = await limiter.limit(`${scope}:${key}`);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
        local: false,
      };
    } catch (error) {
      // Never let a Redis outage take the product down — degrade to local.
      console.error('[rate-limit] Upstash error, falling back to local limiter:', error);
    }
  }

  const local = memoryLimit(`${scope}:${key}`, limitPerWindow, windowMs);
  return { ...local, local: true };
}

/** Reset a key's local bucket (the admin "reset rate limit" action). */
export function resetLocalRateLimit(key: string, scope = 'default') {
  for (const k of buckets.keys()) {
    if (k === `${scope}:${key}` || k.endsWith(`:${key}`)) buckets.delete(k);
  }
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)),
  };
}

export function isUpstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}
