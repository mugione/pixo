// Shared HTTP helpers: one JSON envelope for every API response.

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
}

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ data }), { status, headers: { ...SECURITY_HEADERS, ...extra } })
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
  | 'internal_error'

export function error(code: ErrorCode, message: string, status: number, extra: { fields?: string[]; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify({ error: { code, message, ...(extra.fields ? { fields: extra.fields } : {}) } }), {
    status,
    headers: { ...SECURITY_HEADERS, ...extra.headers },
  })
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

/**
 * CSRF defence for state-changing requests: browsers always send Origin on cross-site POSTs,
 * so reject any Origin that is not this site. (JSON content-type also forces a CORS preflight.)
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('Origin')
  if (!origin) return true // non-browser clients; still protected by Turnstile where it matters
  try {
    return new URL(origin).host === new URL(req.url).host
  } catch {
    return false
  }
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
