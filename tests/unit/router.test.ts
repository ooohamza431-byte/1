import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCooldown,
  cooldownRemainingMs,
  getAllHealthSnapshots,
  getHealthSnapshot,
  hydrateHealthFromDb,
  isCoolingDown,
  markFailure,
  markRateLimited,
  markSuccess,
  orderByHealth,
  __resetHealthForTests,
} from '@/lib/router/health';

// Health bookkeeping persists to Postgres fire-and-forget. Mocking the query
// layer keeps these tests in-process (no connection attempt, no open handle).
vi.mock('@/lib/db/admin-queries', () => ({
  upsertProviderHealth: vi.fn().mockResolvedValue(undefined),
  listProviderHealth: vi.fn().mockResolvedValue([]),
}));

/**
 * Provider health drives the whole routing decision: a provider that just died
 * must be skipped immediately rather than retried on every request.
 *
 * `upsertProviderHealth` is fire-and-forget inside this module, so the awaits
 * below never touch a database — the assertions are all on in-process state.
 */
describe('provider health', () => {
  beforeEach(() => {
    __resetHealthForTests();
  });

  it('starts every provider as unknown with no cooldown', () => {
    const snapshot = getHealthSnapshot('never-seen');
    expect(snapshot.status).toBe('unknown');
    expect(snapshot.cooldownRemainingMs).toBe(0);
    expect(isCoolingDown('never-seen')).toBe(false);
  });

  it('records a success with latency', () => {
    markSuccess('groq', 320);
    const snapshot = getHealthSnapshot('groq');

    expect(snapshot.status).toBe('healthy');
    expect(snapshot.lastLatencyMs).toBe(320);
    expect(snapshot.cooldownRemainingMs).toBe(0);
    expect(snapshot.lastError).toBeNull();
  });

  it('degrades a provider immediately and takes it down after three failures', () => {
    markFailure('cerebras', 'dead', 'HTTP 503');
    expect(getHealthSnapshot('cerebras').status).toBe('degraded');
    expect(getHealthSnapshot('cerebras').lastErrorKind).toBe('dead');

    markFailure('cerebras', 'dead', 'HTTP 503');
    markFailure('cerebras', 'dead', 'HTTP 503');
    expect(getHealthSnapshot('cerebras').status).toBe('down');
  });

  it('benches a provider after a dead error', () => {
    markFailure('cerebras', 'dead', 'HTTP 503');
    const snapshot = getHealthSnapshot('cerebras');

    expect(snapshot.cooldownRemainingMs).toBeGreaterThan(0);
    expect(snapshot.lastError).toContain('503');
    expect(isCoolingDown('cerebras')).toBe(true);
  });

  it('parks a bad key far longer than a rate limit or a network blip', () => {
    markFailure('zai', 'key', 'invalid api key');
    const badKey = cooldownRemainingMs('zai');

    __resetHealthForTests();
    markFailure('zai', 'rate', '429 from upstream');
    const rateLimited = cooldownRemainingMs('zai');

    __resetHealthForTests();
    markFailure('zai', 'unknown', 'socket hang up');
    const unknown = cooldownRemainingMs('zai');

    expect(badKey).toBeGreaterThan(rateLimited);
    expect(rateLimited).toBeGreaterThan(unknown);
    expect(unknown).toBeGreaterThan(0);
  });

  it('backs off further on repeated failures, up to the cap', () => {
    markFailure('mistral', 'dead', 'first');
    const first = cooldownRemainingMs('mistral');

    markFailure('mistral', 'dead', 'second');
    const second = cooldownRemainingMs('mistral');

    markFailure('mistral', 'dead', 'third');
    const third = cooldownRemainingMs('mistral');

    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThanOrEqual(second);
    expect(third).toBeLessThanOrEqual(300_000);
  });

  it('honours an explicit Retry-After from the upstream provider', () => {
    markRateLimited('groq', 120_000);
    expect(cooldownRemainingMs('groq')).toBeGreaterThan(110_000);
    expect(getHealthSnapshot('groq').lastErrorKind).toBe('rate');
  });

  it('clears a cooldown when an admin re-tests a provider', () => {
    markFailure('zai', 'key', 'invalid key');
    expect(cooldownRemainingMs('zai')).toBeGreaterThan(0);

    clearCooldown('zai');
    expect(cooldownRemainingMs('zai')).toBe(0);
    expect(isCoolingDown('zai')).toBe(false);
    expect(getHealthSnapshot('zai').status).toBe('unknown');
  });

  it('resets the failure streak after a success, and needs two to call it healthy', () => {
    markFailure('openrouter', 'cool', 'overloaded');
    markFailure('openrouter', 'cool', 'overloaded');
    markSuccess('openrouter', 800);

    // One good call clears the cooldown, but the status needs a second success
    // before the router stops hedging around this provider.
    const afterOne = getHealthSnapshot('openrouter');
    expect(afterOne.failures).toBe(0);
    expect(afterOne.lastError).toBeNull();
    expect(afterOne.cooldownRemainingMs).toBe(0);
    expect(afterOne.status).toBe('degraded');

    markSuccess('openrouter', 620);
    expect(getHealthSnapshot('openrouter').status).toBe('healthy');
  });

  it('orders the chain so cooling providers go last', () => {
    const targets = [
      { provider: { id: 'down-provider' }, label: 'down' },
      { provider: { id: 'fine-provider' }, label: 'fine' },
      { provider: { id: 'cooling-provider' }, label: 'cooling' },
    ];

    markFailure('down-provider', 'dead', 'gone');
    markSuccess('fine-provider', 200);
    markFailure('cooling-provider', 'rate', 'slow down');

    const ordered = orderByHealth(targets).map((t) => t.provider.id);
    expect(ordered[0]).toBe('fine-provider');
    expect(ordered[ordered.length - 1]).toBe('cooling-provider');
  });

  it('exposes every tracked provider to the admin panel', () => {
    markSuccess('groq', 100);
    markFailure('mistral', 'cool', 'busy');

    const all = getAllHealthSnapshots();
    expect(Object.keys(all)).toEqual(expect.arrayContaining(['groq', 'mistral']));
    expect(all.groq.status).toBe('healthy');
  });

  it('can hydrate more than once without re-running the query', async () => {
    await expect(hydrateHealthFromDb()).resolves.toBeUndefined();
    await expect(hydrateHealthFromDb()).resolves.toBeUndefined();
  });
});
