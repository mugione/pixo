// Worker API tests against a REAL local D1 database (Miniflare via wrangler's getPlatformProxy).
// Only the outbound Turnstile siteverify call is stubbed.
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getPlatformProxy } from 'wrangler'
import { handleContact } from '../worker/contact'
import type { AppEnv } from '../worker/env'
import worker from '../worker/index'

let proxy: Awaited<ReturnType<typeof getPlatformProxy>>
let env: AppEnv

const turnstileOk = (async () => Response.json({ success: true, action: 'contact' })) as unknown as typeof fetch
const turnstileFail = (async () => Response.json({ success: false, 'error-codes': ['invalid-input-response'] })) as unknown as typeof fetch
const turnstileWrongAction = (async () => Response.json({ success: true, action: 'login' })) as unknown as typeof fetch

const body = {
  name: 'Test Kullanıcı',
  email: 'test@example.com',
  subject: 'Merhaba',
  message: 'Bu bir test mesajıdır.',
  consent: true,
  turnstileToken: 'token',
  lang: 'tr',
}

const req = (b: unknown, headers: Record<string, string> = {}) =>
  new Request('https://pixo.tr/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.7', ...headers },
    body: JSON.stringify(b),
  })

beforeAll(async () => {
  proxy = await getPlatformProxy({ configPath: 'wrangler.jsonc', persist: false })
  const db = (proxy.env as { DB: D1Database }).DB
  const sql = readFileSync('migrations/0001_contact_messages.sql', 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
  for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) await db.prepare(stmt).run()
  env = {
    DB: db,
    ASSETS: { fetch: async () => new Response('asset') } as unknown as Fetcher,
    APP_ENV: 'test',
    SITE_URL: 'https://pixo.tr',
    TURNSTILE_SITE_KEY: 'site-key',
    TURNSTILE_SECRET_KEY: 'secret',
    IP_HASH_SALT: 'salt',
  }
}, 60_000)

afterAll(async () => {
  await proxy?.dispose()
})

beforeEach(async () => {
  await env.DB!.prepare('DELETE FROM contact_messages').run()
})

describe('POST /api/contact', () => {
  it('stores a valid message in D1 and never stores the raw IP', async () => {
    const res = await handleContact(req(body), env, turnstileOk)
    expect(res.status).toBe(201)
    const { data } = (await res.json()) as { data: { id: string } }
    const row = await env.DB!.prepare('SELECT * FROM contact_messages WHERE id = ?1').bind(data.id).first<Record<string, string>>()
    expect(row).toMatchObject({ name: 'Test Kullanıcı', email: 'test@example.com', status: 'new', lang: 'tr' })
    expect(row!.ip_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(row)).not.toContain('198.51.100.7')
  })

  it('rejects a failed or mismatched Turnstile verification', async () => {
    expect((await handleContact(req(body), env, turnstileFail)).status).toBe(403)
    expect((await handleContact(req(body), env, turnstileWrongAction)).status).toBe(403)
    const n = await env.DB!.prepare('SELECT COUNT(*) n FROM contact_messages').first<{ n: number }>()
    expect(n!.n).toBe(0)
  })

  it('rate-limits to 5 messages per IP per hour', async () => {
    for (let i = 0; i < 5; i++) expect((await handleContact(req(body), env, turnstileOk)).status).toBe(201)
    const res = await handleContact(req(body), env, turnstileOk)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('3600')
    // A different IP is not affected.
    expect((await handleContact(req(body, { 'CF-Connecting-IP': '198.51.100.8' }), env, turnstileOk)).status).toBe(201)
  })

  it('returns field-level validation errors', async () => {
    const res = await handleContact(req({ ...body, email: 'bad' }), env, turnstileOk)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: { code: 'validation_error', message: 'Invalid fields', fields: ['email'] } })
  })

  it('rejects cross-origin requests (CSRF)', async () => {
    const res = await handleContact(req(body, { Origin: 'https://evil.example' }), env, turnstileOk)
    expect(res.status).toBe(403)
  })

  it('reports unavailable (503) when secrets are not configured', async () => {
    const res = await handleContact(req(body), { ...env, TURNSTILE_SECRET_KEY: undefined }, turnstileOk)
    expect(res.status).toBe(503)
  })
})

describe('router', () => {
  it('serves health, 404 and 405 with the JSON envelope and security headers', async () => {
    const health = await worker.fetch(new Request('https://pixo.tr/api/health'), env)
    expect(health.status).toBe(200)
    expect(health.headers.get('Cache-Control')).toBe('no-store')
    expect(health.headers.get('X-Content-Type-Options')).toBe('nosniff')

    const missing = await worker.fetch(new Request('https://pixo.tr/api/nope'), env)
    expect(missing.status).toBe(404)
    expect(await missing.json()).toMatchObject({ error: { code: 'not_found' } })

    const wrong = await worker.fetch(new Request('https://pixo.tr/api/contact'), env)
    expect(wrong.status).toBe(405)
    expect(wrong.headers.get('Allow')).toBe('POST')
  })

  it('exposes only public config', async () => {
    const res = await worker.fetch(new Request('https://pixo.tr/api/public-config'), env)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ data: { turnstileSiteKey: 'site-key' } })
    expect(text).not.toContain('secret')
    expect(text).not.toContain('salt')
  })
})
