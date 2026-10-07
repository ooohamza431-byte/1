import { listBannedPatterns } from '@/lib/db/admin-queries';

/**
 * Prompt moderation.
 *
 * Admins maintain a list of blocked patterns in /admin/moderation. Each entry
 * is either a regular expression or a literal substring. The check runs before
 * a request is routed, and a hit both blocks the generation and flags the
 * stored message so the moderation view can surface it later.
 */

export interface ModerationHit {
  pattern: string;
  reason: string | null;
}

let cache: { patterns: Awaited<ReturnType<typeof listBannedPatterns>>; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

async function loadPatterns() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.patterns;
  try {
    const patterns = await listBannedPatterns();
    cache = { patterns, fetchedAt: Date.now() };
    return patterns;
  } catch {
    // No database yet (first boot) — nothing is blocked.
    return [];
  }
}

/** Force a refresh after an admin edits the list. */
export function invalidateModerationCache() {
  cache = null;
}

export async function checkPrompt(text: string): Promise<ModerationHit | null> {
  if (!text || text.trim().length === 0) return null;
  const patterns = await loadPatterns();

  for (const entry of patterns) {
    if (entry.enabled === false) continue;

    if (entry.isLiteral) {
      if (text.toLowerCase().includes(entry.pattern.toLowerCase())) {
        return { pattern: entry.pattern, reason: entry.reason };
      }
      continue;
    }

    try {
      const regex = new RegExp(entry.pattern, 'i');
      if (regex.test(text)) return { pattern: entry.pattern, reason: entry.reason };
    } catch {
      // An invalid regex must not break generation — log it and move on. The
      // admin UI validates on save, so this only catches legacy rows.
      console.warn('[moderation] skipping invalid pattern:', entry.pattern);
    }
  }

  return null;
}

/** Validate a candidate pattern before it is stored. */
export function validatePattern(pattern: string, isLiteral: boolean): { ok: boolean; error?: string } {
  if (!pattern.trim()) return { ok: false, error: 'Pattern cannot be empty.' };
  if (pattern.length > 500) return { ok: false, error: 'Pattern is too long (max 500 characters).' };
  if (isLiteral) return { ok: true };
  try {
    new RegExp(pattern, 'i');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Invalid regular expression: ${(error as Error).message}` };
  }
}
