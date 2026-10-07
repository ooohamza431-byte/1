/**
 * Global constants shared by client and server.
 *
 * Anything that defines product behaviour (provider metadata, agent pipeline
 * steps, feature flag keys, quota defaults) lives here so that the admin panel,
 * the router and the UI all read from a single source of truth.
 */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'M1 Mods MultiAgent';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
export const APP_DESCRIPTION =
  'Multi-provider AI studio with a 6-agent build pipeline, free Pollinations image generation and a full admin control plane.';

/** Exact brand tokens from the design brief. */
export const THEME = {
  brand: '#d97757',
  darkbg: '#191919',
  panel: '#262626',
  panel2: '#2f2f2f',
  border: '#3a3a3a',
} as const;

/* -------------------------------------------------------------------------- */
/*  Roles & permissions                                                       */
/* -------------------------------------------------------------------------- */

export const ROLES = ['user', 'admin', 'owner'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_RANK: Record<Role, number> = { user: 0, admin: 1, owner: 2 };

/**
 * Role helpers live here (not in `lib/auth/rbac.ts`) because this module is
 * import-free and therefore safe to pull into the Edge middleware bundle.
 * `rbac.ts` re-exports them for server callers.
 */
export function isAdminRole(role: Role | null | undefined): boolean {
  return role === 'admin' || role === 'owner';
}

export function isOwnerRole(role: Role | null | undefined): boolean {
  return role === 'owner';
}

export function hasRoleAtLeast(role: Role | null | undefined, required: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

/** Every capability the admin panel gates on. */
export const PERMISSIONS = [
  'admin.access',
  'keys.read',
  'keys.write',
  'users.read',
  'users.write',
  'users.delete',
  'users.impersonate',
  'features.write',
  'providers.write',
  'moderation.read',
  'moderation.write',
  'analytics.read',
  'audit.read',
  'system.write',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/* -------------------------------------------------------------------------- */
/*  Providers                                                                 */
/* -------------------------------------------------------------------------- */

export const PROVIDER_IDS = [
  'google',
  'openrouter',
  'zai',
  'groq',
  'cerebras',
  'mistral',
  'deepseek',
  'openai',
  'pollinations',
  'custom',
] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** Providers a user/admin can attach a bespoke API key to. */
export const KEYED_PROVIDER_IDS = PROVIDER_IDS.filter(
  (p) => p !== 'pollinations',
) as Exclude<ProviderId, 'pollinations'>[];

/** Display metadata used before the runtime provider registry loads. */
export const PROVIDER_META: Record<
  ProviderId,
  { name: string; color: string; docsUrl: string; free: boolean; requiresKey: boolean }
> = {
  google: {
    name: 'Google Gemini',
    color: '#4285f4',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/openai',
    free: true,
    requiresKey: true,
  },
  openrouter: {
    name: 'OpenRouter',
    color: '#8b5cf6',
    docsUrl: 'https://openrouter.ai/docs',
    free: true,
    requiresKey: true,
  },
  zai: {
    name: 'Z.ai (GLM)',
    color: '#3b82f6',
    docsUrl: 'https://docs.z.ai/api-reference/llm/chat-completion',
    free: true,
    requiresKey: true,
  },
  groq: {
    name: 'Groq',
    color: '#f55036',
    docsUrl: 'https://console.groq.com/docs',
    free: true,
    requiresKey: true,
  },
  cerebras: {
    name: 'Cerebras',
    color: '#f59e0b',
    docsUrl: 'https://inference-docs.cerebras.ai/models/overview',
    free: true,
    requiresKey: true,
  },
  mistral: {
    name: 'Mistral',
    color: '#ff7000',
    docsUrl: 'https://docs.mistral.ai',
    free: false,
    requiresKey: true,
  },
  deepseek: {
    name: 'DeepSeek',
    color: '#4d6bfe',
    docsUrl: 'https://api-docs.deepseek.com',
    free: false,
    requiresKey: true,
  },
  openai: {
    name: 'OpenAI',
    color: '#10a37f',
    docsUrl: 'https://developers.openai.com/api/docs/models',
    free: false,
    requiresKey: true,
  },
  pollinations: {
    name: 'Pollinations',
    color: '#e11d48',
    docsUrl: 'https://pollinations.ai',
    free: true,
    requiresKey: false,
  },
  custom: {
    name: 'Custom (OpenAI-compatible)',
    color: '#64748b',
    docsUrl: 'https://platform.openai.com/docs/api-reference/chat',
    free: false,
    requiresKey: true,
  },
};

/* -------------------------------------------------------------------------- */
/*  Agents                                                                    */
/* -------------------------------------------------------------------------- */

export const AGENT_IDS = [
  'chat',
  'planner',
  'coder',
  'reviewer',
  'fixer',
  'enhancer',
  'judge',
  'hardener',
] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export const BUILD_AGENT_IDS: AgentId[] = [
  'planner',
  'coder',
  'reviewer',
  'fixer',
  'enhancer',
  'judge',
  'hardener',
];

export const AGENT_LABELS: Record<AgentId, string> = {
  chat: 'Chat',
  planner: 'Planner',
  coder: 'Coder',
  reviewer: 'Reviewer',
  fixer: 'Fixer',
  enhancer: 'Enhancer',
  judge: 'Judge',
  hardener: 'Hardener',
};

/** Suggested models per agent, purely a hint for the UI dropdowns. */
export const AGENT_ROLE_HINTS: Record<AgentId, string> = {
  chat: 'General conversation, Q&A and quick edits.',
  planner: 'Decomposes the request into requirements, roadmap and a file manifest.',
  coder: 'Emits complete, runnable files with zero placeholders.',
  reviewer: 'Audits the generated code and reports concrete defects.',
  fixer: 'Regenerates only the files the reviewer rejected.',
  enhancer: 'Improves polish and accessibility without changing behaviour.',
  judge: 'Scores the build and names at most three remaining defects.',
  hardener: 'Fixes the judge\'s defects and re-scores, looping to a target.',
};

/* -------------------------------------------------------------------------- */
/*  Pipeline defaults                                                         */
/* -------------------------------------------------------------------------- */

export const PIPELINE_DEFAULTS = {
  maxRounds: 2,
  targetScore: 9,
  reviewThreshold: 7,
  hedgeDelayMs: 6500,
  requestTimeoutMs: 240_000,
  maxOutputTokens: 32_000,
} as const;

/* -------------------------------------------------------------------------- */
/*  Feature flags                                                             */
/* -------------------------------------------------------------------------- */

export const FEATURE_FLAGS = [
  'streaming',
  'thinking',
  'deep_harden',
  'smart_web',
  'ocr',
  'vision',
  'image_gen',
  'file_upload',
  'signup',
  'oauth_google',
  'oauth_github',
  'credentials_login',
  'auto_title',
  'usage_tracking',
  'totp_required',
  'maintenance_mode',
  'beta_agents',
] as const;
export type FeatureFlagKey = (typeof FEATURE_FLAGS)[number];

export const FEATURE_FLAG_META: Record<
  FeatureFlagKey,
  { label: string; description: string; group: 'generation' | 'access' | 'system'; beta?: boolean }
> = {
  streaming: {
    label: 'Token streaming',
    description: 'Stream deltas as they arrive (SSE). Disable to force full-response mode.',
    group: 'generation',
  },
  thinking: {
    label: 'Extended thinking',
    description: 'Surface model reasoning traces and allow reasoning-effort control.',
    group: 'generation',
  },
  deep_harden: {
    label: 'Deep harden',
    description: 'Run the judge/hardener loop until the target score is reached.',
    group: 'generation',
  },
  smart_web: {
    label: 'Smart web',
    description: 'Allow web-search augmentation on providers that support it.',
    group: 'generation',
  },
  ocr: {
    label: 'OCR',
    description: 'Client-side text extraction from images via tesseract.js.',
    group: 'generation',
  },
  vision: {
    label: 'Vision',
    description: 'Image understanding and screenshot-to-code.',
    group: 'generation',
  },
  image_gen: {
    label: 'Image generation',
    description: 'Pollinations image studio (free, no key required).',
    group: 'generation',
  },
  file_upload: {
    label: 'File upload',
    description: 'Attach text/code files to a prompt (10 MB server-action limit).',
    group: 'generation',
  },
  signup: {
    label: 'Open signup',
    description: 'Allow new accounts to register. Turn off for invite-only instances.',
    group: 'access',
  },
  oauth_google: { label: 'Google sign-in', description: 'Enable the Google OAuth button.', group: 'access' },
  oauth_github: { label: 'GitHub sign-in', description: 'Enable the GitHub OAuth button.', group: 'access' },
  credentials_login: {
    label: 'Email + password',
    description: 'Allow admin/owner accounts to sign in with credentials.',
    group: 'access',
  },
  auto_title: {
    label: 'Auto chat titles',
    description: 'Derive a conversation title from the first user message.',
    group: 'generation',
  },
  usage_tracking: {
    label: 'Usage tracking',
    description: 'Persist token/cost statistics used by analytics and quotas.',
    group: 'system',
  },
  totp_required: {
    label: 'Require MFA for admins',
    description: 'Reserved for TOTP enrolment. Reports as unmet until configured.',
    group: 'system',
    beta: true,
  },
  maintenance_mode: {
    label: 'Maintenance mode',
    description: 'Blocks new generations with a banner. Existing sessions stay readable.',
    group: 'system',
  },
  beta_agents: {
    label: 'Beta agents',
    description: 'Expose experimental agent roles to admins only.',
    group: 'system',
    beta: true,
  },
};

/** Enabled-by-default flags on a fresh database. */
export const DEFAULT_FEATURES: Record<FeatureFlagKey, boolean> = {
  streaming: true,
  thinking: true,
  deep_harden: true,
  smart_web: true,
  ocr: true,
  vision: true,
  image_gen: true,
  file_upload: true,
  signup: true,
  oauth_google: true,
  oauth_github: true,
  credentials_login: true,
  auto_title: true,
  usage_tracking: true,
  totp_required: false,
  maintenance_mode: false,
  beta_agents: false,
};

/* -------------------------------------------------------------------------- */
/*  System settings defaults                                                  */
/* -------------------------------------------------------------------------- */

export const SYSTEM_DEFAULTS = {
  appName: APP_NAME,
  logoUrl: '',
  faviconUrl: '/favicon.ico',
  rateLimitPerHour: 100,
  rateLimitPerDay: 500,
  maxTokensPerDay: 2_000_000,
  maxBuildsPerDay: 100,
  maxImagesPerDay: 200,
  retryCount: 2,
  coolingPeriodMs: 60_000,
  healthCheckIntervalMs: 300_000,
  allowedSignupDomains: '' as string,
} as const;

export const SYSTEM_SETTING_KEYS = Object.keys(SYSTEM_DEFAULTS) as (keyof typeof SYSTEM_DEFAULTS)[];

/* -------------------------------------------------------------------------- */
/*  Image generation                                                          */
/* -------------------------------------------------------------------------- */

export const IMAGE_SIZES = [
  { label: 'Square · 1024', width: 1024, height: 1024 },
  { label: 'Portrait · 832×1216', width: 832, height: 1216 },
  { label: 'Landscape · 1216×832', width: 1216, height: 832 },
  { label: 'Wide · 1536×640', width: 1536, height: 640 },
  { label: 'Story · 768×1344', width: 768, height: 1344 },
  { label: 'Avatar · 512', width: 512, height: 512 },
] as const;

/**
 * Pollinations currently advertises a single live image model (`sana`); the
 * legacy names are still accepted by the service and route to `sana`. We keep
 * them selectable but always re-validate against `GET /models` at runtime.
 */
export const POLLINATIONS_IMAGE_MODELS = [
  { id: 'sana', label: 'Sana (live default)' },
  { id: 'flux', label: 'Flux (legacy alias)' },
  { id: 'turbo', label: 'Turbo (legacy alias)' },
  { id: 'flux-realism', label: 'Flux Realism (legacy alias)' },
  { id: 'flux-anime', label: 'Flux Anime (legacy alias)' },
  { id: 'kontext', label: 'Kontext (legacy alias)' },
] as const;

export const STYLE_PRESETS = [
  {
    id: 'none',
    label: 'No style',
    suffix: '',
  },
  {
    id: 'photo',
    label: 'Photographic',
    suffix:
      'professional photograph, 85mm lens, shallow depth of field, natural lighting, ultra detailed, high dynamic range',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    suffix: 'cinematic still, dramatic volumetric lighting, anamorphic lens flare, film grain, colour graded',
  },
  {
    id: 'illustration',
    label: 'Illustration',
    suffix: 'detailed digital illustration, clean linework, vibrant palette, artstation trending',
  },
  {
    id: '3d',
    label: '3D render',
    suffix: 'octane render, soft studio lighting, subsurface scattering, ray traced, 8k',
  },
  {
    id: 'anime',
    label: 'Anime',
    suffix: 'anime key visual, cel shading, expressive eyes, clean background, studio quality',
  },
  {
    id: 'logo',
    label: 'Logo / icon',
    suffix: 'minimal flat vector logo, centred composition, negative space, crisp edges, white background',
  },
  {
    id: 'ui',
    label: 'UI mockup',
    suffix: 'clean modern UI mockup, figma style, generous whitespace, subtle shadows, dark interface',
  },
] as const;

/* -------------------------------------------------------------------------- */
/*  Export / preview                                                          */
/* -------------------------------------------------------------------------- */

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'ico'];
export const TEXT_EXTENSIONS = [
  'html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'md', 'txt', 'py', 'rb', 'go', 'rs',
  'java', 'kt', 'c', 'h', 'cpp', 'cs', 'php', 'sh', 'yml', 'yaml', 'toml', 'sql', 'xml', 'env',
  'csv', 'vue', 'svelte', 'astro', 'scss', 'less', 'graphql', 'prisma', 'lock',
];
export const BINARY_EXTENSIONS = ['zip', 'pdf', 'woff', 'woff2', 'ttf', 'otf', 'mp4', 'mp3', 'wav', 'webm'];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Cost table (USD per 1M tokens) used when a provider does not report pricing. */
export const FALLBACK_PRICING: Record<string, { input: number; output: number }> = {
  google: { input: 0.3, output: 2.5 },
  openrouter: { input: 1, output: 3 },
  zai: { input: 0.6, output: 2.2 },
  groq: { input: 0.15, output: 0.6 },
  cerebras: { input: 0.1, output: 0.4 },
  mistral: { input: 0.4, output: 2 },
  deepseek: { input: 0.3, output: 1.2 },
  openai: { input: 2, output: 10 },
  custom: { input: 0, output: 0 },
  pollinations: { input: 0, output: 0 },
};

/* -------------------------------------------------------------------------- */
/*  User-facing copy                                                          */
/* -------------------------------------------------------------------------- */

export const REFINE_CHIPS = [
  'Make it mobile responsive',
  'Add dark mode',
  'Improve accessibility (ARIA + focus states)',
  'Add local persistence',
  'Polish the visual design',
  'Split into modules and add comments',
  'Add input validation and errors',
  'Write tests for the core logic',
] as const;

export const TEMPLATES = [
  {
    id: 'todo',
    title: 'Todo app',
    description: 'Persistent task list with filters, keyboard shortcuts and dark mode.',
    prompt:
      'Build a polished todo application in a single index.html file. Requirements: add/edit/delete tasks, filter by all/active/done, persist to localStorage, keyboard shortcut to focus input, dark mode toggle that respects system preference, accessible ARIA labels, and a clean modern design with the brand colour #d97757.',
    icon: 'ListChecks',
  },
  {
    id: 'dashboard',
    title: 'Analytics dashboard',
    description: 'Responsive dashboard with charts, KPI cards and a data table.',
    prompt:
      'Build a responsive analytics dashboard in a single index.html file using vanilla JS and inline SVG charts (no external libraries). Include four KPI cards, a line chart of 30 days of traffic, a bar chart of top pages, and a sortable table. Support dark mode and mobile layouts down to 360px.',
    icon: 'BarChart3',
  },
  {
    id: 'landing',
    title: 'SaaS landing page',
    description: 'Hero, features, pricing and FAQ with smooth scroll animations.',
    prompt:
      'Build a modern SaaS landing page in a single index.html file. Sections: sticky nav, hero with gradient and CTA, three feature cards, pricing table with monthly/annual toggle, FAQ accordion, footer. Use IntersectionObserver for scroll reveals, respect prefers-reduced-motion, and be fully responsive.',
    icon: 'LayoutTemplate',
  },
  {
    id: 'game',
    title: 'Snake game',
    description: 'Canvas game with score, levels, touch controls and pause.',
    prompt:
      'Build a complete Snake game in a single index.html file using canvas. Requirements: arrow key and WASD controls, swipe controls for touch, growing snake, score and high score in localStorage, increasing speed, pause/resume, game over overlay with restart, and requestAnimationFrame timing that is frame-rate independent.',
    icon: 'Gamepad2',
  },
  {
    id: 'chat-ui',
    title: 'Chat interface',
    description: 'Streaming chat UI with markdown rendering and message history.',
    prompt:
      'Build a chat interface in a single index.html file. Requirements: message list with user/assistant bubbles, markdown rendering including fenced code blocks with copy buttons, auto-growing textarea with Enter to send and Shift+Enter for newline, typing indicator, localStorage history, and a responsive sidebar that collapses on mobile.',
    icon: 'MessagesSquare',
  },
  {
    id: 'form',
    title: 'Multi-step form',
    description: 'Wizard with validation, progress and review step.',
    prompt:
      'Build a multi-step form wizard in a single index.html file. Steps: account, profile, preferences, review. Include per-step validation with inline error messages, a progress indicator, back/next navigation, persistence so a refresh does not lose data, a summary review step with edit links, and full keyboard accessibility.',
    icon: 'ClipboardList',
  },
] as const;
