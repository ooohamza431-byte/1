import { describe, expect, it } from 'vitest';
import {
  buildPreviewDocument,
  detectEntryFile,
  hasCodeBlock,
  looksLikeProseOnly,
  mergeFiles,
  normaliseLanguage,
  parseDefects,
  parseFiles,
  parseReview,
  parseScore,
  sanitizePath,
  stripThinkingTags,
} from '@/lib/agents/parser';

/**
 * The file parser is what turns a stream of text into a project. It has to cope
 * with every dialect of filename annotation the models actually emit, because a
 * miss here means a file silently disappears from the user's download.
 */
describe('parseFiles', () => {
  it('parses an attribute-annotated fence', () => {
    const markdown = ['Here you go:', '', '```html file="index.html"', '<h1>Hi</h1>', '```'].join('\n');
    const files = parseFiles(markdown);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('index.html');
    expect(files[0].content.trim()).toBe('<h1>Hi</h1>');
    expect(files[0].language).toBe('html');
    expect(files[0].bytes).toBeGreaterThan(0);
  });

  it('parses a bare filename in the info string', () => {
    const files = parseFiles(['```tsx App.tsx', 'export default function App() { return null; }', '```'].join('\n'));
    expect(files[0]?.path).toBe('App.tsx');
  });

  it('parses a filename given as the first comment line', () => {
    const markdown = ['```js', '// file: src/utils/math.js', 'export const add = (a, b) => a + b;', '```'].join('\n');
    const files = parseFiles(markdown);
    expect(files[0]?.path).toBe('src/utils/math.js');
    // The comment stays in the file — it is part of the source the model wrote.
    expect(files[0]?.content).toContain('export const add');
  });

  it('infers a filename from the language when nothing is annotated', () => {
    const files = parseFiles(['```css', 'body { margin: 0; }', '```'].join('\n'));
    expect(files[0]?.path).toMatch(/\.css$/);
  });

  it('de-duplicates colliding paths', () => {
    const markdown = [
      '```html file="index.html"',
      '<p>one</p>',
      '```',
      '```html file="index.html"',
      '<p>two</p>',
      '```',
    ].join('\n');
    const files = parseFiles(markdown);
    expect(files).toHaveLength(2);
    expect(new Set(files.map((file) => file.path)).size).toBe(2);
  });

  it('ignores fences that are obviously not files', () => {
    const files = parseFiles(['```bash', 'npm install', '```', '```', 'plain text, no language', '```'].join('\n'));
    expect(files.every((file) => !file.content.includes('plain text, no language'))).toBe(true);
  });

  it('rejects path traversal attempts', () => {
    const files = parseFiles(['```js file="../../etc/passwd"', 'const x = 1;', '```'].join('\n'));
    for (const file of files) {
      expect(file.path.startsWith('/')).toBe(false);
      expect(file.path.includes('..')).toBe(false);
    }
  });
});

describe('sanitizePath', () => {
  it('strips leading slashes and normalises the path', () => {
    expect(sanitizePath('/src/../app.ts')).toBe('app.ts');
    expect(sanitizePath('/src/lib/app.ts')).toBe('src/lib/app.ts');
    expect(sanitizePath('./index.html')).toBe('index.html');
  });

  it('removes every parent-directory segment, not just the first', () => {
    // A single leftover `..` is enough to escape the ZIP extraction root.
    expect(sanitizePath('../../secrets.txt')).toBe('secrets.txt');
    expect(sanitizePath('a/../../b/c.txt')).toBe('b/c.txt');
    expect(sanitizePath('..')).toBe('');
  });

  it('normalises Windows paths and quotes', () => {
    expect(sanitizePath('"C:\\Users\\dev\\app\\main.ts"')).toBe('Users/dev/app/main.ts');
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(sanitizePath('   ')).toBe('');
    expect(sanitizePath('/')).toBe('');
    expect(sanitizePath('.')).toBe('');
  });

  it('caps depth and length so a malicious path cannot bloat the archive', () => {
    const deep = Array.from({ length: 12 }, (_, i) => `level${i}`).join('/');
    expect(sanitizePath(deep).split('/').length).toBeLessThanOrEqual(6);
  });
});

describe('detectEntryFile', () => {
  it('prefers index.html', () => {
    const files = [
      { path: 'styles.css', language: 'css', content: '', bytes: 0 },
      { path: 'index.html', language: 'html', content: '', bytes: 0 },
      { path: 'app.js', language: 'js', content: '', bytes: 0 },
    ];
    expect(detectEntryFile(files)).toBe('index.html');
  });

  it('falls back through the framework entry points, then any html file', () => {
    expect(
      detectEntryFile([
        { path: 'lib/helpers.ts', language: 'ts', content: '', bytes: 40 },
        { path: 'page.tsx', language: 'tsx', content: '', bytes: 10 },
      ]),
    ).toBe('page.tsx');

    expect(
      detectEntryFile([
        { path: 'main.js', language: 'js', content: '', bytes: 10 },
        { path: 'landing/page.html', language: 'html', content: '', bytes: 90 },
      ]),
    ).toBe('landing/page.html');
  });

  it('falls back to the first file when nothing looks like an entry point', () => {
    expect(
      detectEntryFile([
        { path: 'a.js', language: 'js', content: '', bytes: 10 },
        { path: 'b.js', language: 'js', content: '', bytes: 90 },
      ]),
    ).toBe('a.js');
  });

  it('returns an empty string for an empty project', () => {
    expect(detectEntryFile([])).toBe('');
  });
});

describe('mergeFiles', () => {
  it('updates existing files and appends new ones', () => {
    const base = [
      { path: 'index.html', language: 'html', content: 'old', bytes: 3 },
      { path: 'app.js', language: 'js', content: 'keep', bytes: 4 },
    ];
    const merged = mergeFiles(base, [{ path: 'index.html', language: 'html', content: 'new', bytes: 3 }]);

    expect(merged).toHaveLength(2);
    expect(merged.find((file) => file.path === 'index.html')?.content).toBe('new');
    expect(merged.find((file) => file.path === 'app.js')?.content).toBe('keep');
  });

  it('adds files the reviewer asked for that did not exist before', () => {
    const merged = mergeFiles(
      [{ path: 'index.html', language: 'html', content: 'x', bytes: 1 }],
      [{ path: 'assets/logo.svg', language: 'svg', content: '<svg/>', bytes: 5 }],
    );
    expect(merged.map((file) => file.path)).toEqual(['index.html', 'assets/logo.svg']);
  });
});

describe('agent output parsing', () => {
  it('reads the reviewer verdict', () => {
    expect(parseReview('APPROVED — nothing to change.').approved).toBe(true);

    const bugs = parseReview('BUGS FOUND:\n1. The counter never resets.\n2. Escape key does nothing.');
    expect(bugs.approved).toBe(false);
    expect(bugs.defects.length).toBeGreaterThan(0);
  });

  it('reads a judge score in several formats', () => {
    expect(parseScore('SCORE: 9/10')).toBe(9);
    expect(parseScore('Score: 7 / 10')).toBe(7);
    expect(parseScore('no score here')).toBeNull();
  });

  it('extracts at most three defects and skips "none"', () => {
    const defects = parseDefects(
      'SCORE: 6/10\nDEFECTS:\n- The counter never resets after a page reload\n- Escape key does nothing\n- Timer keeps running in a hidden tab\n- Styling ignores the dark theme',
    );
    expect(defects).toHaveLength(3);
    expect(defects[0]).toContain('counter');

    expect(parseDefects('DEFECTS:\n- none')).toEqual([]);
  });

  it('ignores thinking tags when deciding if a reply is prose only', () => {
    const withThinking = 'x<thinking>planning the answer, step by step</thinking>Here is an explanation.';
    expect(stripThinkingTags(withThinking)).toBe('xHere is an explanation.');

    const longProse = Array.from({ length: 60 }, () => 'word').join(' ');
    expect(looksLikeProseOnly(longProse)).toBe(true);
    expect(looksLikeProseOnly('Too short to be prose-only.')).toBe(false);
    expect(hasCodeBlock('```js\nconst x = 1;\n```')).toBe(true);
    expect(hasCodeBlock('no fence here')).toBe(false);
  });
});

describe('normaliseLanguage', () => {
  it('maps aliases to canonical names', () => {
    expect(normaliseLanguage('js')).toBe('javascript');
    expect(normaliseLanguage('TS')).toBe('typescript');
    expect(normaliseLanguage('yml')).toBe('yaml');
    expect(normaliseLanguage('unknown-lang')).toBe('unknown-lang');
  });
});

describe('buildPreviewDocument', () => {
  const files = [
    {
      path: 'index.html',
      language: 'html',
      content:
        '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><h1>Preview</h1><script src="app.js"></script></body></html>',
      bytes: 140,
    },
    { path: 'styles.css', language: 'css', content: 'h1 { color: red; }', bytes: 17 },
    { path: 'app.js', language: 'javascript', content: 'console.log("hi");', bytes: 19 },
  ];

  it('inlines local stylesheets and scripts so the document is self-contained', () => {
    const html = buildPreviewDocument(files, 'index.html');

    expect(html).toContain('<style data-source="styles.css">');
    expect(html).toContain('h1 { color: red; }');
    expect(html).not.toContain('<link rel="stylesheet" href="styles.css">');
    expect(html).toContain('console.log("hi")');
    expect(html).not.toContain('<script src="app.js"></script>');
  });

  it('installs a runtime error hook so a broken build explains itself', () => {
    const html = buildPreviewDocument(files, 'index.html');
    expect(html).toContain('preview-error');
    expect(html).toContain("addEventListener('error'");
  });

  it('still produces a runnable document when there is no html entry file', () => {
    const html = buildPreviewDocument([files[1]], 'styles.css');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('h1 { color: red; }');
  });

  it('escapes a premature script terminator in inlined JavaScript', () => {
    const html = buildPreviewDocument(
      [files[0], { path: 'app.js', language: 'javascript', content: 'const s = "</script>";', bytes: 24 }],
      'index.html',
    );
    // The literal must not close our wrapper script tag early.
    expect(html).toContain('<\\/script>');
  });

  it('returns a usable document for an empty project', () => {
    const html = buildPreviewDocument([], '');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html.length).toBeGreaterThan(100);
  });
});
