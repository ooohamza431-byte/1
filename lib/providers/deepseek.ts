import {
  DEFAULT_TIMEOUT_MS,
  getJson,
  kindFromError,
  postJson,
  probeKey,
  ProviderHttpError,
} from './base';
import type { BodyOptions, ChatMessage, ErrorKind, Provider, StreamOptions } from './types';

/**
 * DeepSeek.
 *
 * Verified 2026-10-07 against
 *   https://api-docs.deepseek.com/quick_start/pricing
 *   https://api-docs.deepseek.com/guides/thinking_mode
 *
 *   base  https://api.deepseek.com  (OpenAI format; `/v1` is an accepted alias)
 *
 * Current models: `deepseek-flash` (DeepSeek-V4.1-Flash, 1M context) and
 * `deepseek-v4-pro` (DeepSeek-V4-Pro, 1M context). The legacy
 * `deepseek-chat` / `deepseek-reasoner` names are retired and re-routed by the
 * vendor, so they are not advertised here.
 *
 * Thinking mode:
 *   { "thinking": { "type": "enabled" | "disabled" } }
 *   { "reasoning_effort": "low" | "high" | "max" }   (mapped: minimal->low,
 *                                                      medium->high, ultra->max)
 * The CoT is returned as `reasoning_content`. In thinking mode `temperature`,
 * `presence_penalty` and `frequency_penalty` are ignored (and top_p is clamped
 * to 0.95–1.0), so they are stripped rather than sent. When a request carries
 * `tools`, prior-turn `reasoning_content` MUST be echoed back or the API
 * returns 400 — handled in `normaliseMessages`.
 */
const BASE_URL = 'https://api.deepseek.com/v1';

function normaliseMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    if (m.role !== 'assistant') return m;
    if (!m.reasoning_content) return m;
    // Keep the trace — the vendor requires it for tool-carrying conversations
    // and ignores it otherwise.
    return { ...m, reasoning_content: m.reasoning_content };
  });
}

export const deepseekProvider: Provider = {
  id: 'deepseek',
  name: 'DeepSeek',
  baseUrl: BASE_URL,
  free: false,
  vision: true,
  imageGen: false,
  supportsWeb: false,
  supportsThinking: true,
  requiresKey: true,
  color: '#4d6bfe',
  docsUrl: 'https://api-docs.deepseek.com',
  notes: 'Thinking is on by default; deepseek-flash supports vision, deepseek-v4-pro does not.',
  defaultModels: {
    text: ['deepseek-flash', 'deepseek-v4-pro'],
    fast: ['deepseek-flash'],
    reasoning: ['deepseek-v4-pro', 'deepseek-flash'],
    code: ['deepseek-v4-pro', 'deepseek-flash'],
    vision: ['deepseek-flash'],
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
    const thinking = opts.thinking !== false;
    const body: Record<string, unknown> = {
      model: opts.model,
      messages: normaliseMessages(
        opts.system ? [{ role: 'system', content: opts.system }, ...opts.messages] : opts.messages,
      ),
      stream: true,
      max_tokens: opts.maxTokens,
    };

    if (opts.topP !== undefined) body.top_p = opts.topP;

    if (thinking) {
      body.thinking = { type: 'enabled' };
      if (opts.reasoningEffort && opts.reasoningEffort !== 'none') {
        body.reasoning_effort = opts.reasoningEffort === 'minimal' ? 'low' : opts.reasoningEffort;
      }
      // temperature / penalties are ignored in thinking mode — omit them so the
      // request stays honest about what actually takes effect.
    } else {
      body.thinking = { type: 'disabled' };
      if (opts.temperature !== undefined) body.temperature = opts.temperature;
    }

    if (opts.extraBody) Object.assign(body, opts.extraBody);
    for (const key of Object.keys(body)) {
      if (body[key] === undefined) delete body[key];
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
    const model = opts.model ?? 'deepseek-flash';
    return probeKey({
      url: `${opts.baseUrl ?? BASE_URL}/chat/completions`,
      headers: this.buildHeaders(key),
      model,
      body: {
        max_tokens: 1,
        // Thinking costs output tokens — probe in non-thinking mode.
        thinking: { type: 'disabled' },
      },
    });
  },

  async discoverModels(key) {
    try {
      const payload = await getJson<{ data?: Array<{ id: string }> }>(
        `${BASE_URL}/models`,
        this.buildHeaders(key),
      );
      return (payload.data ?? []).map((m) => m.id).sort();
    } catch {
      // `/models` requires a valid key and is not available on every account.
      return this.defaultModels.text;
    }
  },

  classifyError(err: unknown): ErrorKind {
    if (err instanceof ProviderHttpError) {
      if (err.status === 402) return 'key';
      if (err.status === 400 && /insufficient|balance/i.test(err.body)) return 'key';
      return err.kind;
    }
    return kindFromError(err);
  },
};

export default deepseekProvider;
