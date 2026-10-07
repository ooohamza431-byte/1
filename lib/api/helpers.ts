import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import { AuthError, requireUser } from '@/lib/auth/rbac';
import { isFeatureEnabled, getSystemSettings } from '@/lib/db/admin-queries';
import { getUsageToday } from '@/lib/db/queries';
import { consumeRateLimit, rateLimitHeaders } from './rate-limit';
import type { SessionUser } from '@/lib/auth/rbac';

/**
 * Shared plumbing for every route handler: uniform JSON responses, Zod
 * validation, authentication, feature-flag gating, quota enforcement and rate
 * limiting. Keeping this in one place is why each route file stays readable.
 */

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, {
    status: 200,
    ...init,
    headers: { 'Cache-Control': 'no-store', ...(init?.headers ?? {}) },
  });
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status = 400, code = 'bad_request', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function fail(message: string, status = 400, code = 'bad_request', details?: unknown) {
  return NextResponse.json(
    { error: message, code, ...(details ? { details } : {}) },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Central error translator used by every handler's catch block. */
export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.message, error.status, error.code, error.details);
  }
  if (error instanceof AuthError) {
    return fail(error.message, error.status, error.code);
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return fail(
      first ? `${first.path.join('.') || 'body'}: ${first.message}` : 'Invalid request body.',
      422,
      'validation_error',
      error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  console.error('[api] unhandled error:', error);

  // Surface the two configuration mistakes that are otherwise opaque.
  if (message.includes('ENCRYPTION_KEY')) {
    return fail(
      'Server misconfiguration: ENCRYPTION_KEY is missing or invalid. Generate one with `openssl rand -hex 32`.',
      500,
      'encryption_unconfigured',
    );
  }
  if (message.includes('No Postgres connection string')) {
    return fail(
      'Server misconfiguration: no database connection string (POSTGRES_URL / DATABASE_URL).',
      500,
      'database_unconfigured',
    );
  }

  return fail('Something went wrong. Please try again.', 500, 'internal_error');
}

/** Parse + validate a JSON body against a Zod schema. */
export async function parseBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError('Request body must be valid JSON.', 400, 'invalid_json');
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw result.error;
  return result.data;
}

/** Validate query parameters. */
export function parseQuery<T>(request: Request, schema: ZodSchema<T>): T {
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  const result = schema.safeParse(params);
  if (!result.success) throw result.error;
  return result.data;
}

/* -------------------------------------------------------------------------- */
/*  Guardrails applied to generation routes                                   */
/* -------------------------------------------------------------------------- */

export interface GenerationContext {
  user: SessionUser;
  settings: Record<string, unknown>;
  rateLimit: Awaited<ReturnType<typeof consumeRateLimit>>;
}

export interface GuardOptions {
  /** Feature flag that must be enabled. */
  requireFeature?: string;
  /** Rate-limit scope + budget. */
  scope?: string;
  limitPerHour?: number;
  /** Skip quota checks (e.g. for read-only routes). */
  skipQuotas?: boolean;
}

/**
 * The shared pre-flight for any route that spends provider tokens:
 * auth → ban check → maintenance mode → rate limit → daily quota.
 */
export async function guardGeneration(
  request: Request,
  options: GuardOptions = {},
): Promise<GenerationContext> {
  const user = await requireUser();

  const settings = await getSystemSettings();

  if (await isFeatureEnabled('maintenance_mode')) {
    throw new ApiError(
      'The instance is in maintenance mode. New generations are paused — please try again shortly.',
      503,
      'maintenance_mode',
    );
  }

  if (options.requireFeature && !(await isFeatureEnabled(options.requireFeature))) {
    throw new ApiError(
      `The "${options.requireFeature}" feature is currently disabled by an administrator.`,
      403,
      'feature_disabled',
    );
  }

  const defaultLimit = Number(settings.rateLimitPerHour ?? 100) || 100;
  const limit = options.limitPerHour ?? defaultLimit;
  const rateLimit = await consumeRateLimit(user.id, limit, options.scope ?? 'chat');

  if (!rateLimit.success) {
    const retryAfter = Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1000));
    throw new ApiError(
      `Rate limit reached (${rateLimit.limit} requests per hour). Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
      429,
      'rate_limited',
      { retryAfter },
    );
  }

  if (!options.skipQuotas) {
    const usage = await getUsageToday(user.id);
    const maxTokens = Number(settings.maxTokensPerDay ?? 2_000_000);
    // A user-level override wins over the system default.
    const perUser = await getPerUserQuota(user.id, 'maxTokensPerDay');
    const effectiveMax = perUser ?? maxTokens;
    if (usage.tokens >= effectiveMax) {
      throw new ApiError(
        `Daily token quota reached (${usage.tokens.toLocaleString()} / ${effectiveMax.toLocaleString()}). It resets at midnight UTC.`,
        429,
        'quota_exceeded',
      );
    }
  }

  void request;
  return { user, settings, rateLimit };
}

/** Attach rate-limit headers to a successful response. */
export function withRateLimit<T extends NextResponse>(response: T, ctx: GenerationContext): T {
  for (const [key, value] of Object.entries(rateLimitHeaders(ctx.rateLimit))) {
    response.headers.set(key, value);
  }
  return response;
}

async function getPerUserQuota(
  userId: string,
  field: 'maxTokensPerDay' | 'maxBuildsPerDay' | 'maxImagesPerDay',
): Promise<number | null> {
  try {
    const { getUserById } = await import('@/lib/db/queries');
    const user = await getUserById(userId);
    const value = user?.[field];
    return typeof value === 'number' ? value : null;
  } catch {
    return null;
  }
}

export { getPerUserQuota };
