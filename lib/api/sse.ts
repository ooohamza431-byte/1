/**
 * Server-Sent Events reader.
 *
 * `EventSource` cannot POST, cannot send an auth cookie cross-route reliably and
 * gives no control over buffering, so the chat route is consumed with `fetch` +
 * a manual stream parser instead. This module implements the framing rules from
 * the SSE spec that matter in practice: `\n` and `\r\n` line endings, multi-line
 * `data:` fields joined with `\n`, comment lines (used for the 15s heartbeat
 * `: ping`) and dispatch on the blank line.
 */

export interface SseEvent<T = unknown> {
  event: string;
  data: T;
  /** Raw data string, for non-JSON payloads. */
  raw: string;
}

export interface SseOptions {
  signal?: AbortSignal;
  onOpen?: (response: Response) => void;
  /** Fired for every `: comment` line — used to keep a "still working" indicator alive. */
  onHeartbeat?: () => void;
}

/**
 * POST a JSON body and yield parsed SSE events until the stream ends.
 * Throws `Error` with the server's message when the request itself fails.
 */
export async function* streamSse<T = unknown>(
  url: string,
  body: unknown,
  options: SseOptions = {},
): AsyncGenerator<SseEvent<T>, void, void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
    signal: options.signal,
    cache: 'no-store',
  });

  options.onOpen?.(response);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let message = `Request failed with status ${response.status}.`;
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      message = parsed.error ?? parsed.message ?? message;
    } catch {
      if (text) message = text.slice(0, 300);
    }
    throw new Error(message);
  }

  if (!response.body) throw new Error('The server returned an empty stream.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Split on a blank line; the trailing fragment stays in the buffer.
      let separator = findSeparator(buffer);
      while (separator !== -1) {
        const block = buffer.slice(0, separator);
        buffer = buffer.slice(separator).replace(/^(\r?\n){2}/, '');
        const parsed = parseBlock<T>(block);
        if (parsed) yield parsed;
        separator = findSeparator(buffer);
      }
    }

    // Flush a final block that arrived without a trailing blank line.
    const trailing = parseBlock<T>(buffer);
    if (trailing) yield trailing;
  } finally {
    reader.releaseLock();
  }
}

function findSeparator(buffer: string): number {
  const lf = buffer.indexOf('\n\n');
  const crlf = buffer.indexOf('\r\n\r\n');
  if (crlf !== -1 && (lf === -1 || crlf < lf)) return crlf;
  return lf;
}

function parseBlock<T>(block: string): SseEvent<T> | null {
  if (!block.trim()) return null;

  let event = 'message';
  const dataLines: string[] = [];

  for (const rawLine of block.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith(':')) continue; // comment / heartbeat
    const colon = rawLine.indexOf(':');
    const field = colon === -1 ? rawLine : rawLine.slice(0, colon);
    const value = colon === -1 ? '' : rawLine.slice(colon + 1).replace(/^ /, '');

    if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
  }

  if (dataLines.length === 0) return null;
  const raw = dataLines.join('\n');

  let data: T;
  try {
    data = JSON.parse(raw) as T;
  } catch {
    data = raw as unknown as T;
  }

  return { event, data, raw };
}

/** Convenience: read a stream and invoke a handler per event. */
export async function consumeSse<T = unknown>(
  url: string,
  body: unknown,
  handler: (event: SseEvent<T>) => void,
  options: SseOptions = {},
): Promise<void> {
  for await (const event of streamSse<T>(url, body, options)) handler(event);
}
