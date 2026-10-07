import {
  DEFAULT_TIMEOUT_MS,
  getJson,
  postJson,
  probeKey,
  kindFromError,
  kindFromStatus,
  streamOptionsToBody,
  ProviderHttpError,
} from './base';
import type {
  BodyOptions,
  ErrorKind,
  Provider,
  ProviderTestResult,
  StreamOptions,
} from './types';

/**
 * Google Gemini — OpenAI-compatibility layer.
 *
 * Verified 2026-10-07 against https://ai.google.dev/gemini-api/docs/openai
 *
 *   base      https://generativelanguage.googleapis.com/v1beta/openai
 *   auth      Authorization: Bearer $GEMINI_API_KEY
 *   thinking  reasoning_effort ("low" | "medium" | "high" ...)
 *             OR extra_body.google.thinking_config.{thinking_level|thinking_budget,
 *             include_thoughts: true} to receive thought summaries.
 *             `reasoning_effort` and `thinking_level` are mutually exclusive —
 *             Google rejects requests that set both.
 */
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

function mapEffort(effort: StreamOptions['reasoningEffort']): 'low' | 'medium' | 'high' | null {
  switch (effort) {
    case 'none':
    case 'minimal':
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
    case 'xhigh':
    case 'max':
      return 'high';
    default:
      return null;
  }
}

export const googleProvider: Provider = {
  id: 'google',
  name: 'Google Gemini',
  baseUrl: BASE_URL,
  free: true,
  vision: true,
  imageGen: true,
  supportsWeb: true,
  supportsThinking: true,
  requiresKey: true,
  color: '#4285f4',
  docsUrl: 'https://ai.google.dev/gemini-api/docs/openai',
  notes:
    'Gemini 3 thinking cannot be disabled; reasoning_effort and thinking_level must not be combined.',
  defaultModels: {
    text: [
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.1-pro',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
    ],
    fast: ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite'],
    reasoning: ['gemini-3.1-pro', 'gemini-3.8-flash'],
    code: ['gemini-3.8-flash', 'gemini-3.1-pro'],
    vision: ['gemini-3.8-flash', 'gemini-3.1-pro', 'gemini-2.5-flash'],
    image: ['gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-nano-banana-2.1'],
  },

  buildHeaders(key) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (key) headers.Authorization = `Bearer ${key}`;
    return headers;
  },

  buildBody(opts: BodyOptions) {
    const body = streamOptionsToBody(opts, {});

    if (opts.thinking) {
      const level = mapEffort(opts.reasoningEffort) ?? 'high';
      // `google.thinking_config` is the documented escape hatch for Gemini-only
      // fields that the OpenAI schema has no slot for.
      body.extra_body = {
        google: {
          thinking_config: {
            thinking_level: level,
            include_thoughts: true,
          },
        },
      };
    } else if (opts.reasoningEffort && opts.reasoningEffort !== 'none') {
      // No thinking_config here: sending both is a 400.
      body.reasoning_effort = mapEffort(opts.reasoningEffort) ?? 'medium';
    }

    if (opts.webSearch) {
      // Gemini's built-in Google Search grounding tool.
      body.tools = [{ google_search: {} }];
    }

    return body;
  },

  async stream(opts: StreamOptions) {
    const url = `${opts.baseUrl ?? BASE_URL}/chat/completions`;
    return postJson({
      url,
      headers: this.buildHeaders(opts.apiKey, opts),
      body: this.buildBody(opts),
      signal: opts.signal,
      stream: true,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
  },

  async testKey(key, opts = {}) {
    const model = opts.model ?? 'gemini-2.5-flash';
    return probeKey({
      url: `${opts.baseUrl ?? BASE_URL}/chat/completions`,
      headers: this.buildHeaders(key),
      model,
      // Gemini rejects max_tokens=1 on some thinking models; 8 is safe.
      body: { max_tokens: 8 },
    });
  },

  async discoverModels(key) {
    const payload = await getJson<{ data?: Array<{ id: string }> }>(
      `${BASE_URL}/models`,
      this.buildHeaders(key),
    );
    const ids = (payload.data ?? [])
      .map((m) => m.id)
      .filter((id) => id.startsWith('gemini') || id.startsWith('models/gemini'))
      .map((id) => id.replace(/^models\//, ''))
      // Image/embedding endpoints are not chat models.
      .filter((id) => !/embedding|aqa|imagen/i.test(id));
    return Array.from(new Set(ids)).sort();
  },

  classifyError(err: unknown): ErrorKind {
    if (err instanceof ProviderHttpError) return err.kind;
    return kindFromError(err);
  },
};

export default googleProvider;
