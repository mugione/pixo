import { validateContact } from '../shared/contact'
import type { AppEnv } from './env'
import { error, json, readJson, sameOrigin, sha256Hex } from './http'
import { verifyTurnstile } from './turnstile'

const MAX_BODY_BYTES = 16 * 1024
const MAX_PER_IP_PER_HOUR = 5

export async function handleContact(req: Request, env: AppEnv, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (!sameOrigin(req)) return error('forbidden', 'Cross-origin request rejected', 403)
  if (!env.DB || !env.TURNSTILE_SECRET_KEY || !env.IP_HASH_SALT) {
    return error('unavailable', 'Contact form is not configured', 503)
  }

  const parsed = await readJson(req, MAX_BODY_BYTES)
  if (!parsed.ok) return parsed.res

  const v = validateContact(parsed.body)
  if (!v.ok) return error('validation_error', 'Invalid fields', 400, { fields: v.fields })
  const input = v.value

  const ip = req.headers.get('CF-Connecting-IP')
  if (!(await verifyTurnstile(env.TURNSTILE_SECRET_KEY, input.turnstileToken, ip, 'contact', fetchImpl))) {
    return error('captcha_failed', 'Security verification failed', 403)
  }

  // Rate limit by salted IP hash (raw IPs are never stored).
  const ipHash = ip ? await sha256Hex(`${env.IP_HASH_SALT}:${ip}`) : null
  if (ipHash) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM contact_messages WHERE ip_hash = ?1 AND created_at > ?2')
      .bind(ipHash, since)
      .first<{ n: number }>()
    if ((row?.n ?? 0) >= MAX_PER_IP_PER_HOUR) {
      return error('rate_limited', 'Too many messages', 429, { headers: { 'Retry-After': '3600' } })
    }
  }

  const id = crypto.randomUUID()
  await env.DB.prepare(
    'INSERT INTO contact_messages (id, name, email, subject, message, lang, ip_hash, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)',
  )
    .bind(id, input.name, input.email, input.subject, input.message, input.lang, ipHash, new Date().toISOString())
    .run()

  return json({ id }, 201)
}
