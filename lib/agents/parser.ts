import type { ProjectFile } from '@/lib/db/schema';

/**
 * File-block parser.
 *
 * Models emit file manifests in a dozen dialects. This parser accepts all of
 * them, in this precedence order:
 *
 *   1. Explicit attribute      ```html file="index.html"
 *                              ```html filename:index.html
 *                              ```html path="src/app.tsx" title="app.tsx"
 *   2. First-line comment      ```html then // index.html
 *                              ```css then a slash-star header comment
 *                              ```html then <!-- index.html -->
 *                              ```css then # app.css
 *                              ```sql then -- schema.sql
 *                              ```md then ### README.md
 *   3. Language inference      ```html  ->  index.html (or page-2.html)
 *   4. Content sniffing        ```      + <!DOCTYPE html>  ->  index.html
 *
 * A block is skipped when it is obviously not a file: shell transcripts,
 * one-line outputs, package-manager commands and elisions.
 *
 * Implementation note: regex literals in this file never contain a raw
 * backtick character — the character is written as \u0060 — because a literal
 * backtick inside a regex makes the TypeScript scanner treat the remainder of
 * the file as a template literal.
 */

/* -------------------------------------------------------------------------- */
/*  Language tables                                                           */
/* -------------------------------------------------------------------------- */

const LANGUAGE_ALIASES: Record<string, string> = {
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  js: 'javascript',
  javascript: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  typescript: 'typescript',
  tsx: 'tsx',
  json: 'json',
  jsonc: 'json',
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'mdx',
  py: 'python',
  python: 'python',
  rb: 'ruby',
  ruby: 'ruby',
  go: 'go',
  golang: 'go',
  rs: 'rust',
  rust: 'rust',
  java: 'java',
  kt: 'kotlin',
  kotlin: 'kotlin',
  swift: 'swift',
  php: 'php',
  cs: 'csharp',
  csharp: 'csharp',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  hpp: 'cpp',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  shell: 'bash',
  zsh: 'bash',
  ps1: 'powershell',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  env: 'dotenv',
  dotenv: 'dotenv',
  xml: 'xml',
  svg: 'svg',
  vue: 'vue',
  svelte: 'svelte',
  astro: 'astro',
  prisma: 'prisma',
  graphql: 'graphql',
  gql: 'graphql',
  dockerfile: 'dockerfile',
  docker: 'dockerfile',
  tf: 'terraform',
  lua: 'lua',
  r: 'r',
  dart: 'dart',
  scala: 'scala',
  elixir: 'elixir',
  ex: 'elixir',
  txt: 'text',
  text: 'text',
  plaintext: 'text',
};

const DEFAULT_EXTENSION: Record<string, string> = {
  html: 'index.html',
  css: 'styles.css',
  scss: 'styles.scss',
  less: 'styles.less',
  javascript: 'script.js',
  jsx: 'App.jsx',
  typescript: 'main.ts',
  tsx: 'App.tsx',
  json: 'data.json',
  markdown: 'README.md',
  mdx: 'content.mdx',
  python: 'main.py',
  ruby: 'main.rb',
  go: 'main.go',
  rust: 'main.rs',
  java: 'Main.java',
  kotlin: 'Main.kt',
  swift: 'main.swift',
  php: 'index.php',
  csharp: 'Program.cs',
  c: 'main.c',
  cpp: 'main.cpp',
  sql: 'schema.sql',
  bash: 'script.sh',
  powershell: 'script.ps1',
  yaml: 'config.yml',
  toml: 'config.toml',
  ini: 'config.ini',
  dotenv: '.env',
  xml: 'data.xml',
  svg: 'image.svg',
  vue: 'App.vue',
  svelte: 'App.svelte',
  astro: 'index.astro',
  prisma: 'schema.prisma',
  graphql: 'schema.graphql',
  dockerfile: 'Dockerfile',
  terraform: 'main.tf',
  lua: 'main.lua',
  dart: 'main.dart',
  scala: 'Main.scala',
  elixir: 'main.ex',
  text: 'notes.txt',
};

const NON_FILE_LANGUAGES = new Set(['console', 'output', 'log', 'diff', 'patch', 'http', 'terminal']);

const FILE_EXTENSION_BY_LANGUAGE: Record<string, string> = {
  html: '.html',
  css: '.css',
  scss: '.scss',
  less: '.less',
  javascript: '.js',
  jsx: '.jsx',
  typescript: '.ts',
  tsx: '.tsx',
  json: '.json',
  markdown: '.md',
  mdx: '.mdx',
  python: '.py',
  ruby: '.rb',
  go: '.go',
  rust: '.rs',
  java: '.java',
  kotlin: '.kt',
  swift: '.swift',
  php: '.php',
  csharp: '.cs',
  c: '.c',
  cpp: '.cpp',
  sql: '.sql',
  bash: '.sh',
  powershell: '.ps1',
  yaml: '.yml',
  toml: '.toml',
  ini: '.ini',
  dotenv: '.env',
  xml: '.xml',
  svg: '.svg',
  vue: '.vue',
  svelte: '.svelte',
  astro: '.astro',
  prisma: '.prisma',
  graphql: '.graphql',
  dockerfile: 'Dockerfile',
  terraform: '.tf',
  lua: '.lua',
  dart: '.dart',
  scala: '.scala',
  elixir: '.ex',
  text: '.txt',
};

/* -------------------------------------------------------------------------- */
/*  Shared character classes                                                  */
/* -------------------------------------------------------------------------- */

/** Filename body: word chars, dots, slashes, @ + -. `/` is escaped for TS. */
const NAME_BODY = '[\\w.\\/@+-]+';
/** A plausible file extension (1–8 alphanumerics). */
const NAME_EXT = '[a-z0-9]{1,8}';
/** Straight or back-tick quote characters, without writing a raw backtick. */
const QUOTES = '["\'\\u0060]';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

export function normaliseLanguage(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/^language-/, '');
  return LANGUAGE_ALIASES[key] ?? (key.length > 0 ? key : 'text');
}

/** Strip traversal, absolute roots and drive letters from a model-supplied path. */
export function sanitizePath(input: string): string {
  const quoteTrim = new RegExp(`^${QUOTES}+|${QUOTES}+$`, 'g');
  const cleaned = input
    .trim()
    .replace(quoteTrim, '')
    .replace(/\\/g, '/')
    .replace(/^[a-zA-Z]:\//, '')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned === '.' || cleaned === '/') return '';

  // Resolve the path with a stack. A leftover `..` segment would let a generated
  // project escape the ZIP extraction root (Zip Slip), and simply deleting the
  // segment would silently move a file somewhere else.
  const segments: string[] = [];
  for (const segment of cleaned.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return segments.slice(0, 6).join('/').slice(0, 200);
}

function extensionOf(path: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(path);
  return match ? match[1].toLowerCase() : '';
}

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

/**
 * Detect a filename written as the first line of a code block, e.g.
 * `// app.js`, `<!-- index.html -->`, `# styles.css`, a slash-star header.
 * Returns the cleaned filename plus the body with that line removed.
 */
function extractFilenameFromFirstLine(
  body: string,
  language: string,
): { name: string | null; content: string } {
  const lines = body.split('\n');
  const maxScan = Math.min(3, lines.length);
  const nameOnly = `(${NAME_BODY}\\.${NAME_EXT})`;
  const maybePrefix = '(?:file(?:name)?\\s*[:=-]\\s*)?';

  for (let i = 0; i < maxScan; i += 1) {
    const line = (lines[i] ?? '').trim();
    if (!line) continue;

    const candidates: RegExp[] = [
      new RegExp(`^\\/\\/\\s*${maybePrefix}${nameOnly}$`, 'i'),
      new RegExp(`^#\\s*${maybePrefix}${nameOnly}$`, 'i'),
      new RegExp(`^\\/\\*\\s*${maybePrefix}${nameOnly}\\s*\\*\\/$`, 'i'),
      new RegExp(`^<!--\\s*${maybePrefix}${nameOnly}\\s*-->$`, 'i'),
      new RegExp(`^--\\s*${maybePrefix}${nameOnly}$`, 'i'),
      new RegExp(`^###?\\s*${maybePrefix}\\u0060?${nameOnly}\\u0060?$`, 'i'),
      new RegExp(`^"""\\s*${nameOnly}\\s*"""$`, 'i'),
    ];

    for (const pattern of candidates) {
      const match = pattern.exec(line);
      if (!match) continue;
      const name = sanitizePath(match[1]);
      if (!name || !name.includes('.')) continue;
      const remaining = [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n');
      return { name, content: remaining.replace(/^\n+/, '') };
    }
  }

  void language;
  return { name: null, content: body };
}

/** Extract file="x" / path: x / title='x' from a fence info string. */
function extractFilenameFromInfo(info: string): string | null {
  const patterns = [
    new RegExp(`\\b(?:file|filename|path|name|title)\\s*=\\s*${QUOTES}([^"'\\u0060]+)${QUOTES}`, 'i'),
    new RegExp(`\\b(?:file|filename|path|name|title)\\s*:\\s*${QUOTES}?(${NAME_BODY}\\.${NAME_EXT})${QUOTES}?`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(info);
    if (!match) continue;
    const name = sanitizePath(match[1]);
    if (name) return name;
  }
  return null;
}

/** A bare filename with no attribute keyword: ```index.html */
function extractBareFilename(info: string): string | null {
  const cleaned = info.replace(/^language-/, '').trim();
  const bare = new RegExp(`^${NAME_BODY}\\.${NAME_EXT}$`, 'i');
  if (bare.test(cleaned) && !LANGUAGE_ALIASES[cleaned.toLowerCase()]) {
    return sanitizePath(cleaned);
  }
  return null;
}

function looksLikeFile(content: string, language: string): boolean {
  if (NON_FILE_LANGUAGES.has(language)) return false;
  const trimmed = content.trim();
  if (trimmed.length === 0) return false;
  if (/^(\.\.\.|\/\/\s*\.\.\.|<!--\s*\.\.\.\s*-->|\/\*\s*\.\.\.\s*\*\/)$/.test(trimmed)) return false;
  if (/^(npm|pnpm|yarn|npx|cd|mkdir|git|pip|python -m|curl|docker)\s/i.test(trimmed)) return false;
  if (trimmed.split('\n').length < 2 && !/[{};<>]/.test(trimmed)) {
    if (trimmed.length < 80) return false;
  }
  return true;
}

function inferFromContent(content: string): string | null {
  const head = content.trim().slice(0, 400).toLowerCase();
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return 'index.html';
  if (head.startsWith('<?xml') && head.includes('<svg')) return 'image.svg';
  if (head.startsWith('{') && /"name"\s*:/.test(head)) return 'package.json';
  return null;
}

function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name.toLowerCase())) {
    taken.add(name.toLowerCase());
    return name;
  }
  const dot = name.lastIndexOf('.');
  const stem = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? '' : name.slice(dot);
  let counter = 2;
  while (taken.has(`${stem}-${counter}${ext}`.toLowerCase())) counter += 1;
  const result = `${stem}-${counter}${ext}`;
  taken.add(result.toLowerCase());
  return result;
}

/* -------------------------------------------------------------------------- */
/*  Main parser                                                               */
/* -------------------------------------------------------------------------- */

export function parseFiles(text: string): ProjectFile[] {
  if (!text || text.length === 0) return [];

  const files: ProjectFile[] = [];
  const taken = new Set<string>();
  const lines = text.split('\n');

  let inFence = false;
  let fenceMarker = '```';
  let info = '';
  let bodyLines: string[] = [];

  const flush = () => {
    const body = bodyLines.join('\n');
    const rawInfo = info.trim();

    let filename = extractFilenameFromInfo(rawInfo);
    let content = body;

    if (!filename) {
      const bare = extractBareFilename(rawInfo);
      if (bare) filename = bare;
    }

    const languageToken =
      rawInfo.split(/\s+/).find((token) => token && !token.includes('=') && !token.includes(':')) ?? '';
    const language = normaliseLanguage(languageToken);

    if (!filename) {
      const extracted = extractFilenameFromFirstLine(content, language);
      if (extracted.name) {
        filename = extracted.name;
        content = extracted.content;
      }
    }

    if (!filename) filename = inferFromContent(content);

    if (!filename) {
      const fallback = DEFAULT_EXTENSION[language];
      if (fallback && looksLikeFile(content, language)) filename = fallback;
    }

    if (!filename || !looksLikeFile(content, language)) {
      bodyLines = [];
      info = '';
      return;
    }

    const finalPath = uniqueName(sanitizePath(filename), taken);
    const inferredLanguage =
      language !== 'text' ? language : normaliseLanguage(extensionOf(finalPath));

    files.push({
      path: finalPath,
      language: FILE_EXTENSION_BY_LANGUAGE[inferredLanguage] ? inferredLanguage : inferredLanguage || 'text',
      content: content.replace(/^\n+|\n+$/g, ''),
      bytes: Buffer.byteLength(content, 'utf8'),
    });

    bodyLines = [];
    info = '';
  };

  for (const line of lines) {
    const fenceMatch = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (!inFence && fenceMatch) {
      inFence = true;
      fenceMarker = fenceMatch[1];
      info = fenceMatch[2] ?? '';
      bodyLines = [];
      continue;
    }
    if (inFence) {
      const closing = /^\s*(`{3,}|~{3,})\s*$/.exec(line);
      if (closing && closing[1][0] === fenceMarker[0] && closing[1].length >= fenceMarker.length) {
        flush();
        inFence = false;
        fenceMarker = '```';
        continue;
      }
      bodyLines.push(line);
      continue;
    }
  }

  if (inFence && bodyLines.length > 0) flush();

  return files;
}

/* -------------------------------------------------------------------------- */
/*  Project helpers                                                           */
/* -------------------------------------------------------------------------- */

export function mergeFiles(base: ProjectFile[], updates: ProjectFile[]): ProjectFile[] {
  const map = new Map(base.map((file) => [file.path.toLowerCase(), file]));
  for (const update of updates) {
    map.set(update.path.toLowerCase(), {
      ...update,
      bytes: Buffer.byteLength(update.content, 'utf8'),
    });
  }
  return Array.from(map.values());
}

export function detectEntryFile(files: ProjectFile[]): string {
  if (files.length === 0) return '';
  const byName = (needle: string) => files.find((f) => basename(f.path).toLowerCase() === needle);
  const bySuffix = (suffix: string) => files.find((f) => f.path.toLowerCase().endsWith(suffix));

  return (
    byName('index.html')?.path ??
    bySuffix('index.html')?.path ??
    byName('page.tsx')?.path ??
    byName('app.tsx')?.path ??
    byName('index.tsx')?.path ??
    byName('main.py')?.path ??
    byName('app.py')?.path ??
    byName('main.go')?.path ??
    byName('index.js')?.path ??
    bySuffix('.html')?.path ??
    files[0].path
  );
}

export function hasCodeBlock(text: string): boolean {
  return /```[\s\S]*?\n[\s\S]*?```/.test(text);
}

/** Remove reasoning traces that some models inline into the visible text. */
export function stripThinkingTags(text: string): string {
  return text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<\|thinking\|>[\s\S]*?<\|\/thinking\|>/gi, '')
    .replace(/^\s*Thinking\.\.\.[\s\S]*?\n\n/i, '')
    .trim();
}

/* -------------------------------------------------------------------------- */
/*  Review / judge parsing                                                    */
/* -------------------------------------------------------------------------- */

export interface ReviewResult {
  approved: boolean;
  defects: string[];
  raw: string;
}

export function parseReview(text: string): ReviewResult {
  const raw = text.trim();
  const approved = /\bAPPROVED\b/i.test(raw) && !/BUGS\s+FOUND/i.test(raw);

  const defects: string[] = [];
  const bugsMatch = /BUGS\s+FOUND\s*:?/i.exec(raw);
  if (bugsMatch) {
    const tail = raw.slice(bugsMatch.index + bugsMatch[0].length);
    for (const line of tail.split('\n')) {
      const match = /^\s*(?:[-*•]|\d+[.)])\s*(.+)$/.exec(line);
      if (match && match[1].trim().length > 3) defects.push(match[1].trim());
    }
    if (defects.length === 0) {
      const paragraph = tail.split(/\n{2,}/)[0]?.trim();
      if (paragraph && paragraph.length > 10) defects.push(paragraph.slice(0, 500));
    }
  }

  return { approved, defects, raw };
}

export function parseScore(text: string): number | null {
  const patterns = [
    /SCORE\s*[:=]\s*(\d{1,2}(?:\.\d)?)\s*\/\s*10/i,
    /SCORE\s*[:=]\s*(\d{1,2}(?:\.\d)?)/i,
    /(\d{1,2}(?:\.\d)?)\s*\/\s*10\b/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      const value = Number.parseFloat(match[1]);
      if (Number.isFinite(value) && value >= 0 && value <= 10) return value;
    }
  }
  return null;
}

export function parseDefects(text: string): string[] {
  const defects: string[] = [];
  const section = /(?:DEFECTS?|ISSUES?|PROBLEMS?)\s*:?([\s\S]*)$/i.exec(text);
  const source = section ? section[1] : text;
  for (const line of source.split('\n')) {
    const match = /^\s*(?:[-*•]|\d+[.)])\s*\**\s*(.+?)\s*\**$/.exec(line);
    if (!match) continue;
    const value = match[1].trim();
    if (value.length < 4) continue;
    if (/^(none|no defects?|n\/a)\.?$/i.test(value)) continue;
    defects.push(value);
    if (defects.length >= 3) break;
  }
  return defects;
}

/** True when the model produced prose instead of files (build failure mode). */
export function looksLikeProseOnly(text: string): boolean {
  if (parseFiles(text).length > 0) return false;
  return text.trim().split(/\s+/).length > 40;
}

/* -------------------------------------------------------------------------- */
/*  Preview document assembly                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Build a single HTML document for the live preview iframe.
 * Inlines local CSS/JS references so the frame needs no server or CDN.
 */
export function buildPreviewDocument(files: ProjectFile[], entryPath?: string): string {
  const entry = entryPath ?? detectEntryFile(files);
  // Only a real HTML file may become the preview document. Treating whatever
  // `entry` points at as HTML breaks the CSS-only / JS-only projects that a
  // request like "just give me the stylesheet" produces.
  const isHtml = (f: ProjectFile) => /\.html?$/i.test(f.path) || f.language === 'html';
  const htmlFile = files.find((f) => f.path === entry && isHtml(f)) ?? files.find(isHtml);

  const cssFiles = files.filter((f) => /\.css$/i.test(f.path));
  const jsFiles = files.filter((f) => /\.(js|mjs)$/i.test(f.path));
  const cssBundle = cssFiles.map((f) => `/* ${f.path} */\n${f.content}`).join('\n\n');
  const jsBundle = jsFiles.map((f) => `/* ${f.path} */\n${f.content}`).join('\n;\n');

  const errorHook = [
    '<script>',
    '(function(){',
    "  function show(msg){var d=document.getElementById('preview-error');",
    "    if(!d){d=document.createElement('pre');d.id='preview-error';",
    "      d.style.cssText='position:fixed;left:0;right:0;bottom:0;max-height:40%;overflow:auto;margin:0;padding:10px 14px;background:#3b1d1d;color:#fca5a5;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;z-index:2147483647';",
    '      document.body.appendChild(d);}',
    "    d.textContent+=msg+'\\n';}",
    "  window.addEventListener('error',function(e){show('Error: '+(e.message||'unknown')+(e.lineno?' (line '+e.lineno+')':''));});",
    "  window.addEventListener('unhandledrejection',function(e){show('Unhandled rejection: '+(e.reason&&e.reason.message||e.reason));});",
    '})();',
    '</script>',
  ].join('\n');

  if (!htmlFile) {
    return [
      '<!DOCTYPE html>',
      '<html lang="en"><head><meta charset="utf-8"/>',
      '<meta name="viewport" content="width=device-width,initial-scale=1"/>',
      '<title>Preview</title>',
      `<style>${cssBundle || 'body{font-family:ui-sans-serif,system-ui,sans-serif;background:#191919;color:#e5e5e5;padding:24px;margin:0}'}</style>`,
      '</head><body>',
      '<div id="app"></div>',
      jsBundle ? `<script type="module">${jsBundle.replace(/<\/script>/gi, '<\\/script>')}</script>` : '',
      errorHook,
      '</body></html>',
    ].join('\n');
  }

  let document = htmlFile.content;

  document = document.replace(/<link[^>]+href=["']([^"']+)["'][^>]*>/gi, (match, href: string) => {
    const needle = href.replace(/^\.\//, '').split('/').pop() ?? '';
    const file = cssFiles.find((f) => f.path.endsWith(needle) || basename(f.path) === needle);
    if (!file) return match;
    return `<style data-source="${file.path}">\n${file.content}\n</style>`;
  });

  document = document.replace(
    /<script[^>]+src=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
    (match, src: string) => {
      const needle = src.replace(/^\.\//, '').split('/').pop() ?? '';
      const file = jsFiles.find((f) => f.path.endsWith(needle) || basename(f.path) === needle);
      if (!file) return match;
      return `<script data-source="${file.path}">\n${file.content.replace(/<\/script>/gi, '<\\/script>')}\n</script>`;
    },
  );

  if (!/<style/i.test(document) && cssBundle) {
    document = document.includes('</head>')
      ? document.replace('</head>', `<style>${cssBundle}</style></head>`)
      : `<style>${cssBundle}</style>${document}`;
  }
  if (!/<script/i.test(document) && jsBundle) {
    document = document.includes('</body>')
      ? document.replace('</body>', `<script>${jsBundle}</script></body>`)
      : `${document}<script>${jsBundle}</script>`;
  }

  document = document.includes('</head>')
    ? document.replace('</head>', `${errorHook}</head>`)
    : `${errorHook}${document}`;

  return document;
}

export function projectSizeLabel(files: ProjectFile[]): string {
  const bytes = files.reduce(
    (total, file) => total + (file.bytes || Buffer.byteLength(file.content, 'utf8')),
    0,
  );
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
