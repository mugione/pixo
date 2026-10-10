// Auth edge cases on a real local D1 (the full passkey ceremony is covered by scripts/e2e-app.mjs
// with a Chromium virtual authenticator).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AppEnv } from '../../worker/env'
import worker from '../../worker/index'
import { setupDb } from './helpers'

let proxy: Awaited<ReturnType<typeof setupDb>>['proxy']
let db: D1Database
let env: AppEnv

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  worker.fetch(
    new Request(`https://pixo.tr${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://pixo.tr', 'CF-Connecting-IP': '203.0.113.5', ...headers },
      body: JSON.stringify(body),
    }),
    env,
  )

const reg = { displayName: 'Test Kişi', purpose: 'ecommerce', acceptTerms: true, language: 'tr' }

beforeAll(async () => {
  ;({ proxy, db } = await setupDb())
  env = { DB: db, ASSETS: { fetch: async () => new Response('x') } as unknown as Fetcher, APP_ENV: 'test', SITE_URL: 'https://pixo.tr', IP_HASH_SALT: 'salt', ALLOWED_ORIGINS: 'https://pixo.tr' }
}, 60_000)
afterAll(async () => proxy?.dispose())
beforeEach(async () => {
  await db.batch([db.prepare('DELETE FROM rate_limits'), db.prepare('DELETE FROM auth_challenges'), db.prepare("UPDATE system_settings SET value = 'true' WHERE key = 'registrations_enabled'")])
})

describe('passkey registration', () => {
  it('issues WebAuthn options bound to the request origin, requiring a resident key', async () => {
    const res = await post('/api/auth/register/options', reg)
    expect(res.status).toBe(200)
    const { data } = (await res.json()) as { data: { challengeId: string; options: { rp: { id: string }; authenticatorSelection: { residentKey: string } } } }
    expect(data.options.rp.id).toBe('pixo.tr')
    expect(data.options.authenticatorSelection.residentKey).toBe('required')
  })

  it('rejects origins that are not allowed', async () => {
    const res = await post('/api/auth/register/options', reg, { Origin: 'https://evil.example' })
    expect(res.status).toBe(403)
  })

  it('validates fields and requires accepting the terms', async () => {
    const res = await post('/api/auth/register/options', { displayName: 'a', purpose: 'x', email: 'bad' })
    expect(await res.json()).toMatchObject({ error: { code: 'validation_error', fields: ['displayName', 'email', 'purpose', 'acceptTerms'] } })
  })

  it('respects the registrations kill-switch', async () => {
    await db.prepare("UPDATE system_settings SET value = 'false' WHERE key = 'registrations_enabled'").run()
    const res = await post('/api/auth/register/options', reg)
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: { code: 'registrations_closed' } })
  })

  it('consumes a challenge on first use, even when verification fails', async () => {
    const { data } = (await (await post('/api/auth/register/options', reg)).json()) as { data: { challengeId: string } }
    const bogus = { id: 'abc', rawId: 'abc', type: 'public-key', response: { clientDataJSON: 'e30', attestationObject: 'oA' }, clientExtensionResults: {} }
    expect((await post('/api/auth/register/verify', { challengeId: data.challengeId, response: bogus })).status).toBe(400)
    const again = await post('/api/auth/register/verify', { challengeId: data.challengeId, response: bogus })
    expect(await again.json()).toMatchObject({ error: { code: 'auth_failed', message: 'Challenge expired or invalid' } })
  })

  it('rate-limits registrations per IP (5/hour)', async () => {
    for (let i = 0; i < 5; i++) expect((await post('/api/auth/register/options', reg)).status).toBe(200)
    expect((await post('/api/auth/register/options', reg)).status).toBe(429)
    expect((await post('/api/auth/register/options', reg, { 'CF-Connecting-IP': '203.0.113.6' })).status).toBe(200)
    const raw = await db.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE key LIKE '%203.0.113%'").first<{ n: number }>()
    expect(raw!.n).toBe(0) // only hashed keys are stored
  })
})

describe('recovery codes', () => {
  it('rejects invalid codes and rate-limits guessing (10/hour)', async () => {
    for (let i = 0; i < 10; i++) expect((await post('/api/auth/recovery', { code: 'AAAA-BBBB-CCCC' })).status).toBe(400)
    expect((await post('/api/auth/recovery', { code: 'AAAA-BBBB-CCCC' })).status).toBe(429)
  })
})

describe('session-protected routes', () => {
  it.each([
    ['GET', '/api/auth/me'],
    ['GET', '/api/projects'],
    ['GET', '/api/brands'],
    ['GET', '/api/ai/usage'],
    ['GET', '/api/user/history'],
  ])('%s %s requires a session', async (method, path) => {
    const res = await worker.fetch(new Request(`https://pixo.tr${path}`, { method }), env)
    expect(res.status).toBe(401)
  })

  it('rejects forged or expired session cookies', async () => {
    const res = await worker.fetch(new Request('https://pixo.tr/api/auth/me', { headers: { Cookie: '__Host-pixo_session=forged' } }), env)
    expect(res.status).toBe(401)
  })

  it('redirects signed-out visitors from /app to /login with a safe next parameter', async () => {
    const res = await worker.fetch(new Request('https://pixo.tr/app/projects?x=1'), env)
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://pixo.tr/login?next=%2Fapp%2Fprojects%3Fx%3D1')
  })
})
