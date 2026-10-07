import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils/cn';
import { formatBytes, formatCost, formatTokens, slugify, timeAgo, truncate } from '@/lib/utils/format';
import { composerPlaceholder, estimateTokens, guessMode, isLikelyMultiFile } from '@/lib/utils/intent';
import { buildIconPrompt, enhancePrompt, resolveSeed, variationSuggestions } from '@/lib/utils/image-prompts';
import { validatePattern } from '@/lib/api/moderation';
import { withQuery } from '@/lib/api/client';
import { evaluateAccess, isAdminPath, isPublicPath } from '@/lib/auth/middleware-helpers';
import { can, PERMISSION_MIN_ROLE } from '@/lib/auth/rbac';
import { hasRoleAtLeast, isAdminRole, ROLE_RANK } from '@/lib/constants';

describe('cn', () => {
  it('merges conditional classes and resolves Tailwind conflicts', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm', false && 'hidden', 'font-medium')).toBe('text-sm font-medium');
  });
});

describe('format helpers', () => {
  it('formats tokens compactly', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(12_400)).toBe('12k');
    expect(formatTokens(2_500_000)).toBe('2.50M');
    expect(formatTokens(null)).toBe('—');
  });

  it('keeps sub-cent costs visible', () => {
    expect(formatCost(0)).toBe('$0.00');
    expect(formatCost(0.0004)).toBe('$0.0004');
    expect(formatCost(3.5)).toBe('$3.50');
  });

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('slugs a title safely', () => {
    expect(slugify('My Cool App!!')).toBe('my-cool-app');
    expect(slugify('///')).toBe('project');
  });

  it('truncates with an ellipsis', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcd…');
  });

  it('describes recent times', () => {
    expect(timeAgo(new Date())).toBe('just now');
  });
});

describe('intent helpers', () => {
  it('guesses build mode from verbs plus nouns', () => {
    expect(guessMode('build a landing page with a pricing table')).toBe('build');
    expect(guessMode('what is a closure?')).toBe('chat');
    expect(guessMode('hi')).toBe('chat');
  });

  it('spots multi-file requests', () => {
    expect(isLikelyMultiFile('a full-stack Next.js app with a database')).toBe(true);
    expect(isLikelyMultiFile('a colour picker')).toBe(false);
  });

  it('estimates tokens and switches placeholder copy', () => {
    expect(estimateTokens('a'.repeat(400))).toBe(100);
    expect(composerPlaceholder('build')).toContain('Describe the app');
  });
});

describe('image prompts', () => {
  it('appends a style suffix and composition guidance', () => {
    const enhanced = enhancePrompt('a lighthouse at dusk', { style: 'photo', aspect: 'landscape' });
    expect(enhanced.toLowerCase()).toContain('lighthouse');
    expect(enhanced).not.toBe('a lighthouse at dusk');
    expect(enhanced).toContain('wide establishing shot');

    // Clause-level dedupe: the quality tail is never repeated.
    const tail = enhanced.split(', ').filter((clause) => clause === 'ultra detailed');
    expect(tail).toHaveLength(1);
  });

  it('leaves the prompt untouched in raw mode', () => {
    expect(enhancePrompt('exactly this', { raw: true })).toBe('exactly this');
  });

  it('resolves a deterministic seed', () => {
    expect(resolveSeed(42)).toBe(42);
    expect(resolveSeed(null)).toBeTypeOf('number');
  });

  it('builds icon prompts for each style', () => {
    expect(buildIconPrompt('a fox', 'flat')).toContain('fox');
    expect(buildIconPrompt('a fox', '3d')).not.toBe(buildIconPrompt('a fox', 'flat'));
  });

  it('suggests variations', () => {
    expect(variationSuggestions('a forest').length).toBeGreaterThan(0);
  });
});

describe('moderation pattern validation', () => {
  it('accepts a valid regex', () => {
    expect(validatePattern('\\bpassword\\b', false).ok).toBe(true);
  });

  it('rejects an invalid regex but accepts the same text as a literal', () => {
    expect(validatePattern('(unclosed', false).ok).toBe(false);
    expect(validatePattern('(unclosed', true).ok).toBe(true);
  });

  it('rejects empty patterns', () => {
    expect(validatePattern('   ', false).ok).toBe(false);
  });
});

describe('withQuery', () => {
  it('drops empty values', () => {
    expect(withQuery('/api/admin/users', { role: 'admin', search: undefined, banned: '' })).toBe(
      '/api/admin/users?role=admin',
    );
    expect(withQuery('/api/health', {})).toBe('/api/health');
  });
});

describe('rbac', () => {
  it('ranks roles', () => {
    expect(ROLE_RANK.user).toBeLessThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeLessThan(ROLE_RANK.owner);
    expect(isAdminRole('owner')).toBe(true);
    expect(isAdminRole('user')).toBe(false);
    expect(hasRoleAtLeast('admin', 'admin')).toBe(true);
    expect(hasRoleAtLeast('user', 'admin')).toBe(false);
  });

  it('gates destructive permissions to the owner', () => {
    expect(PERMISSION_MIN_ROLE['users.delete']).toBe('owner');
    expect(PERMISSION_MIN_ROLE['system.write']).toBe('owner');
    expect(can('owner', 'users.delete')).toBe(true);
    expect(can('admin', 'users.delete')).toBe(false);
    expect(can('user', 'keys.read')).toBe(false);
    expect(can(null, 'keys.read')).toBe(false);
  });
});

describe('middleware access policy', () => {
  it('classifies paths', () => {
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/api/health')).toBe(true);
    expect(isPublicPath('/_next/static/chunk.js')).toBe(true);
    expect(isPublicPath('/studio')).toBe(false);
    expect(isAdminPath('/admin/keys')).toBe(true);
    expect(isAdminPath('/administrator')).toBe(false);
  });

  it('sends anonymous visitors to sign-in', () => {
    expect(evaluateAccess('/studio', null).action).toBe('redirect-signin');
    expect(evaluateAccess('/admin', null).action).toBe('redirect-signin');
    // API routes answer with JSON, never an HTML redirect.
    expect(evaluateAccess('/api/chat', null)).toEqual({
      action: 'forbidden',
      reason: 'Sign in required.',
      status: 401,
    });
  });

  it('lets a signed-in user into the studio', () => {
    expect(evaluateAccess('/studio', { role: 'user', banned: false }).action).toBe('allow');
  });

  it('keeps every public marketing page open', () => {
    for (const path of ['/', '/about', '/pricing', '/docs', '/signin', '/signup']) {
      expect(evaluateAccess(path, null).action, `${path} should be public`).toBe('allow');
    }
  });

  it('lets an unknown route reach the 404 page instead of a sign-in wall', () => {
    expect(evaluateAccess('/definitely-not-a-real-route', null).action).toBe('allow');
    expect(evaluateAccess('/definitely-not-a-real-route', { role: 'user', banned: false }).action).toBe('allow');
  });

  it('blocks a plain user from the admin panel', () => {
    const decision = evaluateAccess('/admin/users', { role: 'user', banned: false });
    expect(decision.action).toBe('forbidden');
    if (decision.action === 'forbidden') expect(decision.status).toBe(403);
  });

  it('blocks banned accounts even on public-ish studio routes', () => {
    expect(evaluateAccess('/studio', { role: 'user', banned: true }).action).toBe('forbidden');
  });

  it('allows the owner everywhere', () => {
    expect(evaluateAccess('/admin/system', { role: 'owner', banned: false }).action).toBe('allow');
  });
});
