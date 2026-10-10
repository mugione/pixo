// Minimal typed client for the Pixo API. All endpoints return `{ data }` or `{ error: { code, message, fields? } }`.

export type ApiErrorCode =
  | 'validation_error'
  | 'captcha_failed'
  | 'rate_limited'
  | 'unavailable'
  | 'not_found'
  | 'method_not_allowed'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'internal_error'
  | 'network_error'
  | 'forbidden'
  | 'unauthorized'
  | 'conflict'
  | 'registrations_closed'
  | 'auth_failed'
  | 'quota_exceeded'
  | 'system_quota_exceeded'
  | 'ai_disabled'
  | 'ai_failed'

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public fields: string[] = [],
  ) {
    super(message)
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError('network_error', 'Network error')
  }
  let body: { data?: T; error?: { code: ApiErrorCode; message: string; fields?: string[] } } | null = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON (e.g. proxy error page) */
  }
  if (!res.ok || !body || body.error) {
    const e = body?.error
    throw new ApiError(e?.code ?? (res.status >= 500 ? 'unavailable' : 'internal_error'), e?.message ?? res.statusText, e?.fields)
  }
  return body.data as T
}

export const newIdempotencyKey = () => crypto.randomUUID()

export const post = <T,>(path: string, data: unknown, headers?: Record<string, string>) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(data), headers })
export const put = <T,>(path: string, data: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(data) })
export const del = <T,>(path: string, data?: unknown) =>
  api<T>(path, { method: 'DELETE', ...(data === undefined ? {} : { body: JSON.stringify(data) }) })
