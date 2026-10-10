// Shared HTTP helpers: one JSON envelope for every API response.
import type { AppEnv } from './env'

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
}

export function json(data: unknown, status = 200, extra: Record<string, string> | Headers = {}): Response {
  const headers = new Headers(SECURITY_HEADERS)
  new Headers(extra).forEach((v, k) => headers.append(k, v))
  return new Response(JSON.stringify({ data }), { status, headers })
}

export type ErrorCode =
  | 'validation_error'
  | 'captcha_failed'
  | 'rate_limited'
  | 'unavailable'
  | 'not_found'
  | 'method_not_allowed'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'forbidden'
  | 'unauthorized'
  | 'conflict'
  | 'registrations_closed'
  | 'auth_failed'
  | 'quota_exceeded'
  | 'system_quota_exceeded'
  | 'ai_disabled'
  | 'ai_failed'
  | 'internal_error'

export function error(
  code: ErrorCode,
  message: string,
  status: number,
  extra: { fields?: string[]; headers?: Record<string, string> | Headers } = {},
): Response {
  const headers = new Headers(SECURITY_HEADERS)
  if (extra.headers) new Headers(extra.headers).forEach((v, k) => headers.append(k, v))
  return new Response(JSON.stringify({ error: { code, message, ...(extra.fields ? { fields: extra.fields } : {}) } }), {
    status,
    headers,
  })
}

/** Thrown inside handlers to short-circuit with an error response. */
export class HttpError extends Error {
  constructor(public res: Response) {
    super('http_error')
  }
}
export const fail = (...args: Parameters<typeof error>): never => {
  throw new HttpError(error(...args))
}

/** Reads a JSON body with a hard size cap (defends against oversized payloads). */
export async function readJson(req: Request, maxBytes: number): Promise<{ ok: true; body: unknown } | { ok: false; res: Response }> {
  const type = req.headers.get('Content-Type') ?? ''
  if (!type.toLowerCase().startsWith('application/json')) {
    return { ok: false, res: error('unsupported_media_type', 'Content-Type must be application/json', 415) }
  }
  const declared = Number(req.headers.get('Content-Length') ?? '0')
  if (declared > maxBytes) return { ok: false, res: error('payload_too_large', 'Request body too large', 413) }
  const text = await req.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return { ok: false, res: error('payload_too_large', 'Request body too large', 413) }
  }
  try {
    return { ok: true, body: JSON.parse(text) }
  } catch {
    return { ok: false, res: error('validation_error', 'Invalid JSON', 400) }
  }
}

/** Same as readJson but throws HttpError; returns a plain object (never null/array). */
export async function body(req: Request, maxBytes = 16 * 1024): Promise<Record<string, unknown>> {
  const r = await readJson(req, maxBytes)
  if (!r.ok) throw new HttpError(r.res)
  const b = r.body
  return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : {}
}

export function allowedOrigins(env: Pick<AppEnv, 'ALLOWED_ORIGINS'>): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

/**
 * CSRF defence for state-changing requests: browsers always send Origin on cross-site POSTs,
 * so reject any Origin that is neither this host nor explicitly allowed.
 * (JSON content-type also forces a CORS preflight, and no CORS headers are ever returned.)
 */
export function sameOrigin(req: Request, env: Pick<AppEnv, 'ALLOWED_ORIGINS'> = {}): boolean {
  const origin = req.headers.get('Origin')
  if (!origin) return true // non-browser clients; session cookies are SameSite=Lax anyway
  try {
    if (new URL(origin).host === new URL(req.url).host) return true
  } catch {
    return false
  }
  return allowedOrigins(env).includes(origin.replace(/\/$/, ''))
}

export function getCookie(req: Request, name: string): string | null {
  const header = req.headers.get('Cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
