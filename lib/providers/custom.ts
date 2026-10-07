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
 * Custom OpenAI-compatible endpoints.
 *
 * Admins can register any gateway that speaks `/chat/completions`
 * (vLLM, Ollama, LM Studio, LiteLLM, Together, Fireworks, a corporate proxy,
 * Azure-style deployments, ...) at runtime from /admin/providers. The endpoint
 * is stored in `custom_providers` with an encrypted key, and this factory turns
 * a record into a first-class `Provider` that the router treats exactly like a
 * built-in.
 *
 * Two model-discovery strategies are supported:
 *   1. `GET {baseUrl}/models`  (standard OpenAI shape) — tried first.
 *   2. The models list saved on the record by the admin.
 */

export interface CustomProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  models?: string[];
  /** Injected by the caller because the record stores ciphertext. */
  key?: string | null;
  supportsThinking?: boolean;
  supportsVision?: boolean;
  notes?: string;
}

function normaliseBase(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  // Accept both `https://host/v1` and `https://host` (append /v1 when the path
  // has no version segment, which is what most gateways expect).
  if (/\/v\d+$/.test(trimmed) || /\/api$/.test(trimmed) || trimmed.includes('/chat/completions')) {
    return trimmed;
  }
  return `${trimmed}/v1`;
}

function completionsUrl(baseUrl: string): string {
  const base = normaliseBase(baseUrl);
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
}

export function createCustomProvider(config: CustomProviderConfig): Provider {
  const base = normaliseBase(config.baseUrl);

  const provider: Provider = {
    id: config.id,
    name: config.name,
    baseUrl: base,
    free: false,
    vision: config.supportsVision ?? false,
    imageGen: false,
    supportsWeb: false,
    supportsThinking: config.supportsThinking ?? false,
    requiresKey: true,
    color: '#64748b',
    docsUrl: config.baseUrl,
    notes: config.notes ?? 'Admin-registered OpenAI-compatible endpoint.',
    defaultModels: {
      text: config.models && config.models.length > 0 ? config.models : [config.defaultModel],
      fast: [config.defaultModel],
      code: [config.defaultModel],
      ...(config.supportsVision ? { vision: [config.defaultModel] } : {}),
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
      if (opts.thinking && config.supportsThinking && opts.reasoningEffort && opts.reasoningEffort !== 'none') {
        // Both dialects are offered; gateways that support neither ignore them.
        body.reasoning_effort = opts.reasoningEffort;
        body.reasoning = { effort: opts.reasoningEffort };
      }
      return body;
    },

    async stream(opts: StreamOptions) {
      const target = opts.baseUrl ? completionsUrl(opts.baseUrl) : `${base}/chat/completions`;
      return postJson({
        url: target,
        headers: this.buildHeaders(opts.apiKey, opts),
        body: this.buildBody(opts),
        signal: opts.signal,
        stream: true,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
    },

    async testKey(key, opts = {}) {
      const model = opts.model ?? config.defaultModel;
      const target = opts.baseUrl ? completionsUrl(opts.baseUrl) : `${base}/chat/completions`;
      return probeKey({
        url: target,
        headers: this.buildHeaders(key),
        model,
        // Not every gateway accepts max_tokens=1 with streaming disabled.
        body: { max_tokens: 4 },
        timeoutMs: 20_000,
      });
    },

    async discoverModels(key, baseUrlOverride) {
      const target = baseUrlOverride ?? base;
      try {
        const payload = await getJson<{ data?: Array<{ id: string }> }>(
          `${normaliseBase(target)}/models`,
          this.buildHeaders(key),
        );
        const ids = (payload.data ?? []).map((m) => m.id);
        if (ids.length > 0) return ids.sort();
      } catch {
        /* fall through to the saved list */
      }
      return config.models && config.models.length > 0 ? config.models : [config.defaultModel];
    },

    classifyError(err: unknown): ErrorKind {
      if (err instanceof ProviderHttpError) return err.kind;
      return kindFromError(err);
    },
  };

  return provider;
}

/**
 * The generic instance used when a user supplies an arbitrary base URL for a
 * one-off request (the "Custom" option in the model picker).
 */
export const customProvider: Provider = createCustomProvider({
  id: 'custom',
  name: 'Custom (OpenAI-compatible)',
  baseUrl: 'https://api.openai.com/v1',
  defaultModel: 'gpt-6-luna',
  models: [],
  notes:
    'Set a base URL and model explicitly. Anything that implements POST /chat/completions with SSE works.',
});

export default customProvider;
export { normaliseBase, completionsUrl };
