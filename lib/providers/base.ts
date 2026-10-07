import type {
  ChatMessage,
  ErrorKind,
  NormalizedUsage,
  ProviderTestResult,
  StreamEvent,
  StreamOptions,
  WebResult,
} from './types';

/**
 * Shared transport plumbing for the OpenAI-compatible providers.
 *
 * This module deliberately contains ZERO provider-specific behaviour: every
 * endpoint, header, body field and error mapping lives in the provider file
 * itself. What is here is the boring part that would otherwise be duplicated
 * nine times — SSE frame parsing, timeout handling and status→error mapping.
 */

export const DEFAULT_TIMEOUT_MS = 240_000;
export const TEST_TIMEOUT_MS = 30_000;

export class ProviderHttpError extends Error {
  readonly status: number;
  readonly body: string;
  readonly kind: ErrorKind;
  readonly retryAfterMs?: number;

  constructor(status: number, body: string, kind: ErrorKind, retryAfterMs?: number) {
    super(`HTTP ${status}: ${body.slice(0, 400)}`);
    this.name = 'ProviderHttpError';
    this.status = status;
    this.body = body;
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }
}

/* -------------------------------------------------------------------------- */
/*  Error classification                                                      */
/* -------------------------------------------------------------------------- */

export function kindFromStatus(status: number, body = ''): ErrorKind {
  if (status === 401 || status === 403) return 'key';
  if (status === 402) return 'key'; // out of credit — needs a different key
  if (status === 429) return 'rate';
  if (status === 408 || status === 504) return 'dead';
  if (status === 404) return 'dead'; // model retired / endpoint moved
  if (status === 400 && /credit|balance|quota|insufficient/i.test(body)) return 'key';
  if (status >= 500) return 'dead';
  if (status === 413 || status === 422) return 'cool';
  return 'unknown';
}

export function messageFromError(err: unknown): string {
  if (err instanceof ProviderHttpError) return err.message;
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'Request aborted';
    // Node's fetch surfaces DNS/TLS failures as a generic TypeError.
    if (err.message.includes('fetch failed')) {
      const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
      return `Network error: ${cause?.code ?? cause?.message ?? 'fetch failed'}`;
    }
    return err.message;
  }
  return String(err);
}

export function kindFromError(err: unknown): ErrorKind {
  if (err instanceof ProviderHttpError) return err.kind;
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'cool';
    const message = err.message.toLowerCase();
    if (message.includes('fetch failed') || message.includes('enotfound') || message.includes('econnrefused')) {
      return 'dead';
    }
    if (message.includes('cors')) return 'cors';
    if (message.includes('timeout') || message.includes('timed out')) return 'dead';
  }
  return 'unknown';
}

/* -------------------------------------------------------------------------- */
/*  Fetch helpers                                                             */
/* -------------------------------------------------------------------------- */

export interface PostOptions {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Merge the caller's abort signal with the internal timeout. */
  stream?: boolean;
}

/**
 * POST JSON and return the raw Response. Throws `ProviderHttpError` for non-2xx
 * so the router can classify without re-reading the body.
 */
export async function postJson(opts: PostOptions): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const onAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', onAbort, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(opts.url, {
      method: 'POST',
      headers: opts.headers,
      body: JSON.stringify(opts.body),
      signal: controller.signal,
      // Streaming responses must not be buffered by the runtime.
      cache: 'no-store',
      // @ts-expect-error - Next/undici extension; harmless elsewhere.
      duplex: 'half',
    });
  } catch (error) {
    clearTimeout(timeout);
    opts.signal?.removeEventListener('abort', onAbort);
    throw error;
  }

  if (opts.stream && response.ok) {
    // Keep the timeout alive only while the body is being read; the caller
    // owns clearing it by consuming (or cancelling) the stream.
    const originalBody = response.body;
    if (originalBody) {
      const reader = originalBody.getReader();
      const wrapped = new ReadableStream<Uint8Array>({
        async pull(controller2) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              clearTimeout(timeout);
              controller2.close();
              return;
            }
            controller2.enqueue(value);
          } catch (error) {
            clearTimeout(timeout);
            controller2.error(error);
          }
        },
        cancel(reason) {
          clearTimeout(timeout);
          opts.signal?.removeEventListener('abort', onAbort);
          return reader.cancel(reason);
        },
      });
      return new Response(wrapped, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
  }

  if (!response.ok) {
    clearTimeout(timeout);
    opts.signal?.removeEventListener('abort', onAbort);
    const body = await response.text().catch(() => '');
    const retryAfter = Number(response.headers.get('retry-after-ms') ?? 0);
    const retryAfterSeconds = Number(response.headers.get('retry-after') ?? 0);
    const retryAfterMs = retryAfter || (retryAfterSeconds ? retryAfterSeconds * 1000 : undefined);
    throw new ProviderHttpError(response.status, body, kindFromStatus(response.status, body), retryAfterMs);
  }

  return response;
}

/** GET returning parsed JSON, used by `discoverModels` and `testKey`. */
export async function getJson<T = unknown>(
  url: string,
  headers: Record<string, string>,
  timeoutMs = TEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers, signal: controller.signal, cache: 'no-store' });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ProviderHttpError(response.status, body, kindFromStatus(response.status, body));
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

/* -------------------------------------------------------------------------- */
/*  SSE parsing                                                               */
/* -------------------------------------------------------------------------- */

export interface ParsedChunk {
  text: string;
  thinking: string;
  finishReason: string | null;
  usage: NormalizedUsage | null;
  web: WebResult[] | null;
  model?: string;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null ? (value as JsonRecord) : null;
}

function pickString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Convert a single provider chunk into normalised fields.
 *
 * Handles the union of every dialect we integrate with:
 *   - `choices[0].delta.content`           (OpenAI, Groq, Cerebras, Mistral, DeepSeek, Google, Z.ai, OpenRouter)
 *   - `choices[0].delta.reasoning_content` (DeepSeek, Z.ai, Google thought summaries)
 *   - `choices[0].delta.reasoning`         (OpenRouter)
 *   - `choices[0].delta.reasoning_details` (OpenRouter structured reasoning)
 *   - `choices[0].message.*`               (non-streaming fallback)
 *   - `usage` with `prompt_tokens`/`completion_tokens` or the newer
 *     `input_tokens`/`output_tokens` pair
 *   - `web_search[]` results from Z.ai
 */
export function parseChunk(payload: unknown): ParsedChunk | null {
  const root = asRecord(payload);
  if (!root) return null;

  const out: ParsedChunk = { text: '', thinking: '', finishReason: null, usage: null, web: null };

  const choices = Array.isArray(root.choices) ? root.choices : [];
  const choice = asRecord(choices[0]);
  if (choice) {
    const delta = asRecord(choice.delta) ?? asRecord(choice.message);
    if (delta) {
      out.text += pickString(delta.content);

      const reasoningDirect = pickString(delta.reasoning_content) || pickString(delta.reasoning);
      if (reasoningDirect) out.thinking += reasoningDirect;

      const details = delta.reasoning_details;
      if (Array.isArray(details)) {
        for (const detail of details) {
          const rec = asRecord(detail);
          if (!rec) continue;
          // OpenRouter emits summary parts incrementally as well as full text.
          const text = pickString(rec.text) || pickString(rec.summary);
          if (text) out.thinking += text;
        }
      }

      // Some gateways stream the reasoning as content parts.
      if (Array.isArray(delta.content)) {
        out.text = '';
        for (const part of delta.content) {
          const rec = asRecord(part);
          if (!rec) continue;
          if (typeof rec.text === 'string') out.text += rec.text;
        }
      }
    }
    if (typeof choice.finish_reason === 'string') out.finishReason = choice.finish_reason;
  }

  const usage = asRecord(root.usage);
  if (usage) {
    const prompt =
      Number(usage.prompt_tokens ?? usage.input_tokens ?? 0) || 0;
    const completion =
      Number(usage.completion_tokens ?? usage.output_tokens ?? 0) || 0;
    const total = Number(usage.total_tokens ?? prompt + completion) || prompt + completion;
    const cost = Number(usage.cost ?? 0) || 0;
    if (prompt || completion || total) {
      out.usage = {
        promptTokens: Math.round(prompt),
        completionTokens: Math.round(completion),
        totalTokens: Math.round(total),
        ...(cost > 0 ? { costUsd: cost } : {}),
      };
    }
  }

  const webSearch = root.web_search;
  if (Array.isArray(webSearch)) {
    const results: WebResult[] = [];
    for (const item of webSearch) {
      const rec = asRecord(item);
      if (!rec) continue;
      results.push({
        title: pickString(rec.title) || pickString(rec.link) || 'Result',
        url: pickString(rec.link) || undefined,
        content: pickString(rec.content) || undefined,
      });
    }
    if (results.length > 0) out.web = results;
  }

  if (typeof root.model === 'string') out.model = root.model;

  const empty =
    !out.text && !out.thinking && !out.finishReason && !out.usage && !out.web && !out.model;
  return empty ? null : out;
}

/**
 * Async generator over an OpenAI-style `text/event-stream` body.
 * Yields normalised events; stops at `data: [DONE]` or end of stream.
 */
export async function* iterateSSE(
  response: Response,
  opts: { signal?: AbortSignal } = {},
): AsyncGenerator<StreamEvent> {
  const body = response.body;
  if (!body) {
    yield { type: 'error', message: 'Upstream returned an empty stream body.', kind: 'dead' };
    return;
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  try {
    while (!finished) {
      if (opts.signal?.aborted) {
        yield { type: 'error', message: 'Aborted', kind: 'cool' };
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line; tolerate both LF and CRLF.
      let separator = buffer.search(/\r?\n\r?\n/);
      while (separator !== -1) {
        const rawFrame = buffer.slice(0, separator);
        buffer = buffer.slice(separator + (buffer[separator] === '\r' ? 4 : (buffer[separator + 1] === '\n' ? 2 : 2)));

        for (const line of rawFrame.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (!trimmed.startsWith('data:')) continue;

          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') {
            finished = true;
            break;
          }
          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue; // partial or vendor keep-alive frame
          }

          const errorRec = asRecord(asRecord(parsed)?.error);
          if (errorRec) {
            yield {
              type: 'error',
              message: pickString(errorRec.message) || 'Upstream error frame',
              kind: 'unknown',
            };
            continue;
          }

          const chunk = parseChunk(parsed);
          if (!chunk) continue;
          if (chunk.thinking) yield { type: 'thinking', text: chunk.thinking };
          if (chunk.text) yield { type: 'delta', text: chunk.text };
          if (chunk.web) yield { type: 'web', results: chunk.web };
          if (chunk.usage) yield { type: 'usage', usage: chunk.usage };
          if (chunk.finishReason) yield { type: 'finish', reason: chunk.finishReason };
        }
        if (finished) break;
        separator = buffer.search(/\r?\n\r?\n/);
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* the stream is already closed */
    }
  }
}

/**
 * Read a non-streaming JSON completion and convert it to the same event stream,
 * so the router has a single code path regardless of provider transport.
 */
export async function* iterateFullJson(response: Response): AsyncGenerator<StreamEvent> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    const text = await response.text().catch(() => '');
    yield { type: 'error', message: `Unparseable response: ${text.slice(0, 200)}`, kind: 'unknown' };
    return;
  }
  const chunk = parseChunk(payload);
  if (!chunk) {
    yield { type: 'error', message: 'Empty completion returned by provider.', kind: 'dead' };
    return;
  }
  if (chunk.thinking) yield { type: 'thinking', text: chunk.thinking };
  if (chunk.text) yield { type: 'delta', text: chunk.text };
  if (chunk.web) yield { type: 'web', results: chunk.web };
  if (chunk.usage) yield { type: 'usage', usage: chunk.usage };
  yield { type: 'finish', reason: chunk.finishReason ?? 'stop' };
}

/* -------------------------------------------------------------------------- */
/*  Key probing                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Minimal probe used by the admin "Test" button and the user key tester.
 * Sends a 1-token completion so the key is exercised against the real
 * endpoint rather than a lightweight metadata route.
 */
export async function probeKey(opts: {
  url: string;
  headers: Record<string, string>;
  model: string;
  body?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<ProviderTestResult> {
  const started = Date.now();
  try {
    const response = await postJson({
      url: opts.url,
      headers: opts.headers,
      body: {
        model: opts.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
        ...opts.body,
      },
      timeoutMs: opts.timeoutMs ?? TEST_TIMEOUT_MS,
    });
    const latencyMs = Date.now() - started;
    // Drain the body so the connection can be reused / closed cleanly.
    await response.text().catch(() => '');
    return { ok: true, latencyMs, model: opts.model };
  } catch (error) {
    const latencyMs = Date.now() - started;
    if (error instanceof ProviderHttpError) {
      return {
        ok: false,
        latencyMs,
        status: error.status,
        error: `${error.status}: ${error.body.slice(0, 200) || error.message}`,
        model: opts.model,
      };
    }
    return { ok: false, latencyMs, error: messageFromError(error), model: opts.model };
  }
}

/** Build an OpenAI-shaped messages array, prepending the system prompt. */
export function withSystem(messages: ChatMessage[], system?: string): ChatMessage[] {
  if (!system) return messages;
  return [{ role: 'system', content: system }, ...messages];
}

export function streamOptionsToBody(opts: StreamOptions, overrides: Record<string, unknown> = {}) {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: withSystem(opts.messages, opts.system),
    stream: true,
    max_tokens: opts.maxTokens,
    ...overrides,
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.topP !== undefined) body.top_p = opts.topP;
  if (opts.extraBody) Object.assign(body, opts.extraBody);
  // Strip undefined so providers that reject explicit nulls stay happy.
  for (const key of Object.keys(body)) {
    if (body[key] === undefined) delete body[key];
  }
  return body;
}
