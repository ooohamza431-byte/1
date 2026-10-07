/**
 * Browser-side fetch wrapper.
 *
 * Every route returns either the payload itself or `{ error, code, details }`,
 * so one helper can turn both into either a typed value or an `ApiClientError`.
 * Nothing here contacts a provider — all upstream calls happen server-side.
 */

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code = 'error', details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isAuth() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isRateLimit() {
    return this.status === 429;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Suppress the automatic sign-in redirect on 401 (used by probes). */
  silentAuth?: boolean;
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text.slice(0, 400) };
    }
  }

  if (!response.ok) {
    const record = (payload ?? {}) as { error?: string; message?: string; code?: string; details?: unknown };
    throw new ApiClientError(
      record.error ?? record.message ?? `Request failed with status ${response.status}.`,
      response.status,
      record.code ?? 'error',
      record.details,
    );
  }

  return payload as T;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, silentAuth, ...init } = options;

  const response = await fetch(path, {
    ...init,
    method: init.method ?? (body === undefined ? 'GET' : 'POST'),
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
  });

  // A 401 on a page means the session expired; bounce to sign-in once.
  if (response.status === 401 && !silentAuth && typeof window !== 'undefined') {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    if (!window.location.pathname.startsWith('/signin')) {
      window.location.href = `/signin?next=${next}`;
    }
  }

  return parse<T>(response);
}

export const apiGet = <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'GET' });
export const apiPost = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  apiFetch<T>(path, { ...options, method: 'POST', body });
export const apiPatch = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  apiFetch<T>(path, { ...options, method: 'PATCH', body });
export const apiPut = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  apiFetch<T>(path, { ...options, method: 'PUT', body });
export const apiDelete = <T>(path: string, options?: RequestOptions) =>
  apiFetch<T>(path, { ...options, method: 'DELETE' });

/** Build a query string, dropping empty values. */
export function withQuery(path: string, params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/** Human-readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

/**
 * Compress an image file for vision requests. Providers charge by pixel area
 * and reject large payloads, so images are downscaled to a 1280px longest edge
 * and re-encoded as JPEG (or kept as PNG when they contain transparency).
 */
export async function fileToDataUrl(file: File, maxEdge = 1280, quality = 0.86): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image file.'));
    reader.readAsDataURL(file);
  });

  if (file.type === 'image/gif') return dataUrl;

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Could not decode the image.'));
      element.src = dataUrl;
    });

    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    if (scale === 1 && dataUrl.length < 1_200_000) return dataUrl;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return dataUrl;

    const hasAlpha = file.type === 'image/png' || file.type === 'image/webp';
    if (!hasAlpha) {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(hasAlpha ? 'image/png' : 'image/jpeg', quality);
  } catch {
    return dataUrl;
  }
}
