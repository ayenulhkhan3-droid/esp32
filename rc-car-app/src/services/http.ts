import { API_CONFIG } from '../config/api';

export type ApiErrorKind =
  | 'offline'
  | 'timeout'
  | 'aborted'
  | 'http'
  | 'unauthorized'
  | 'not_found'
  | 'invalid_json'
  | 'invalid_response'
  | 'server';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function describeError(error: unknown): string {
  if (isApiError(error)) return error.message;
  return 'Unexpected error. Please try again.';
}

interface PostOptions {
  token?: string | null;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function serverErrorMessage(body: unknown): string | null {
  if (body && typeof body === 'object' && 'error' in body) {
    const value = (body as { error: unknown }).error;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * POSTs JSON and returns the parsed body only if the server replied with HTTP 2xx
 * and `{"ok": true, ...}`. Everything else becomes a typed ApiError; nothing is
 * ever treated as success by default. Request bodies are never logged.
 */
export async function postJson<T extends { ok: true }>(
  url: string,
  body: Record<string, unknown>,
  { token, timeoutMs = API_CONFIG.requestTimeoutMs, signal }: PostOptions = {},
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (timedOut) throw new ApiError('timeout', 'Server did not respond in time.');
    if (signal?.aborted) throw new ApiError('aborted', 'Request cancelled.');
    throw new ApiError('offline', 'Cannot reach the server. Check your internet connection.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  let text: string;
  try {
    text = await response.text();
  } catch {
    throw new ApiError('invalid_response', 'Could not read the server response.', response.status);
  }

  let parsed: unknown = null;
  const trimmed = text.trim();
  if (trimmed) {
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      parsed = undefined;
    }
  }

  if (response.status === 401 || response.status === 403) {
    throw new ApiError(
      'unauthorized',
      serverErrorMessage(parsed) ?? 'Your session has expired. Please log in again.',
      response.status,
    );
  }
  if (response.status === 404) {
    throw new ApiError('not_found', 'Server endpoint not found (HTTP 404).', 404);
  }
  if (!response.ok) {
    throw new ApiError(
      'http',
      serverErrorMessage(parsed) ?? `Server error (HTTP ${response.status}).`,
      response.status,
    );
  }
  if (parsed === undefined || parsed === null) {
    throw new ApiError('invalid_json', 'Server returned an invalid response.', response.status);
  }
  if (typeof parsed !== 'object' || (parsed as { ok?: unknown }).ok !== true) {
    throw new ApiError(
      'server',
      serverErrorMessage(parsed) ?? 'Server rejected the request.',
      response.status,
    );
  }
  return parsed as T;
}
