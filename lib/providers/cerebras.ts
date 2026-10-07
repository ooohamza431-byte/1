import {
  DEFAULT_TIMEOUT_MS,
  getJson,
  kindFromError,
  postJson,
  probeKey,
  streamOptionsToBody,
  ProviderHttpError,
} from './base';
import type { BodyOptions, ErrorKind, Provider, StreamOptions } from './types';

/**
 * Cerebras — wafer-scale inference, OpenAI-compatible.
 *
 * Verified 2026-10-07 against https://inference-docs.cerebras.ai/models/overview
 *
 *   POST https://api.cerebras.ai/v1/chat/completions
 *   GET  https://api.cerebras.ai/v1/models
 *
 * Shared inference currently serves exactly two models — `gpt-oss-120b`
 * (120B, ~3000 tok/s, 65k context on the free tier) and `qwen-3.8-27b`
 * (~1850 tok/s, 64k). Additional families are reserved-capacity only, so this
 * provider advertises a deliberately short catalogue.
 */
const BASE_URL = 'https://api.cerebras.ai/v1';

export const cerebrasProvider: Provider = {
  id: 'cerebras',
  name: 'Cerebras',
  baseUrl: BASE_URL,
  free: true,
  vision: false,
  imageGen: false,
  supportsWeb: false,
  supportsThinking: true,
  requiresKey: true,
  color: '#f59e0b',
  docsUrl: 'https://inference-docs.cerebras.ai/models/overview',
  notes: 'Very high throughput. Free tier context is 65k (gpt-oss-120b) / 64k (qwen-3.8-27b).',
  defaultModels: {
    text: ['gpt-oss-120b', 'qwen-3.8-27b'],
    fast: ['qwen-3.8-27b'],
    reasoning: ['gpt-oss-120b'],
    code: ['gpt-oss-120b', 'qwen-3.8-27b'],
  },

  buildHeaders(key, opts) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(opts?.extraHeaders ?? {}),
    };
    if (key) headers.Authorization = `Bearer ${key}`;
    return headers;
  },

  buildBody(opts: BodyOptions) {
    const body = streamOptionsToBody(opts, {});

    if (opts.thinking && /gpt-oss/i.test(opts.model)) {
      const effort = opts.reasoningEffort && opts.reasoningEffort !== 'none' ? opts.reasoningEffort : 'medium';
      body.reasoning_effort = effort === 'xhigh' || effort === 'max' ? 'high' : effort;
      body.include_reasoning = true;
    }

    return body;
  },

  async stream(opts: StreamOptions) {
    return postJson({
      url: `${opts.baseUrl ?? BASE_URL}/chat/completions`,
      headers: this.buildHeaders(opts.apiKey, opts),
      body: this.buildBody(opts),
      signal: opts.signal,
      stream: true,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
  },

  async testKey(key, opts = {}) {
    const model = opts.model ?? 'gpt-oss-120b';
    return probeKey({
      url: `${opts.baseUrl ?? BASE_URL}/chat/completions`,
      headers: this.buildHeaders(key),
      model,
      body: { max_tokens: 1, reasoning_effort: 'low' },
    });
  },

  async discoverModels(key) {
    const payload = await getJson<{ data?: Array<{ id: string }> }>(
      `${BASE_URL}/models`,
      this.buildHeaders(key),
    );
    return (payload.data ?? []).map((m) => m.id).sort();
  },

  classifyError(err: unknown): ErrorKind {
    if (err instanceof ProviderHttpError) {
      // Cerebras returns 404 for models that are not on shared inference.
      if (err.status === 404) return 'dead';
      return err.kind;
    }
    return kindFromError(err);
  },
};

export default cerebrasProvider;
