// Passkey (WebAuthn) authentication. No passwords and no e-mail delivery are needed.
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server'
import { PURPOSES } from '../../shared/auth'
import type { AppEnv } from '../env'
import { allowedOrigins, body, fail, json } from '../http'
import { clientIp, rateLimit } from '../ratelimit'
import type { Ctx, Router } from '../router'
import { getSettings } from '../settings'
import { audit, clearSessionCookie, createSession, publicUser, requireUser } from '../session'
import { verifyTurnstile } from '../turnstile'
import { b64url, fromB64url, normalizeRecoveryCode, nowIso, oneOf, recoveryCode, sha256Hex, str, uuid } from '../util'

const RP_NAME = 'Pixo AI'
const CHALLENGE_TTL_MS = 5 * 60_000
const RECOVERY_CODE_COUNT = 10
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/

export function db(env: AppEnv): D1Database {
  if (!env.DB) return fail('unavailable', 'Database not configured', 503)
  return env.DB
}

/** Resolves the WebAuthn origin + RP ID from the browser Origin header, only for allowed hosts. */
export function webauthnOrigin(ctx: Ctx): { origin: string; rpID: string } {
  const origin = (ctx.req.headers.get('Origin') ?? '').replace(/\/$/, '')
  if (!origin) return fail('forbidden', 'Origin header required', 403)
  let host: string
  try {
    host = new URL(origin).host
  } catch {
    return fail('forbidden', 'Invalid origin', 403)
  }
  const ok = host === ctx.url.host || allowedOrigins(ctx.env).includes(origin)
  if (!ok) return fail('forbidden', 'Origin not allowed', 403)
  return { origin, rpID: new URL(origin).hostname }
}

async function saveChallenge(d: D1Database, kind: string, challenge: string, rp: { origin: string; rpID: string }, userId: string | null, payload?: object) {
  const id = uuid()
  await d.batch([
    d.prepare('DELETE FROM auth_challenges WHERE expires_at < ?1').bind(nowIso()),
    d
      .prepare('INSERT INTO auth_challenges (id, challenge, kind, user_id, payload, rp_id, origin, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
      .bind(id, challenge, kind, userId, payload ? JSON.stringify(payload) : null, rp.rpID, rp.origin, new Date(Date.now() + CHALLENGE_TTL_MS).toISOString()),
  ])
  return id
}

type ChallengeRow = { challenge: string; kind: string; user_id: string | null; payload: string | null; rp_id: string; origin: string }

/** Single-use: the row is deleted as it is read. */
async function takeChallenge(d: D1Database, id: unknown, kind: string): Promise<ChallengeRow> {
  if (typeof id !== 'string') return fail('validation_error', 'challengeId required', 400)
  const row = await d
    .prepare('DELETE FROM auth_challenges WHERE id = ?1 AND kind = ?2 AND expires_at > ?3 RETURNING challenge, kind, user_id, payload, rp_id, origin')
    .bind(id, kind, nowIso())
    .first<ChallengeRow>()
  if (!row) return fail('auth_failed', 'Challenge expired or invalid', 400)
  return row
}

async function issueRecoveryCodes(d: D1Database, env: AppEnv, userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, recoveryCode)
  const salt = env.IP_HASH_SALT ?? ''
  const stmts = [d.prepare('DELETE FROM recovery_codes WHERE user_id = ?1').bind(userId)]
  for (const c of codes) {
    stmts.push(
      d.prepare('INSERT INTO recovery_codes (id, user_id, code_hash) VALUES (?1, ?2, ?3)').bind(uuid(), userId, await sha256Hex(`${salt}:rc:${normalizeRecoveryCode(c)}`)),
    )
  }
  await d.batch(stmts)
  return codes
}

async function guard(ctx: Ctx, bucket: string, limit: number, windowSec: number) {
  const d = db(ctx.env)
  if (!(await rateLimit(d, `${bucket}:${clientIp(ctx.req)}`, ctx.env.IP_HASH_SALT ?? '', limit, windowSec))) {
    return fail('rate_limited', 'Too many attempts', 429, { headers: { 'Retry-After': String(windowSec) } })
  }
}

async function requireTurnstile(ctx: Ctx, token: unknown, action: string) {
  // Enforced whenever a secret is configured. Without one, rate limits + quotas still apply.
  if (!ctx.env.TURNSTILE_SECRET_KEY) return
  const ok = await verifyTurnstile(ctx.env.TURNSTILE_SECRET_KEY, typeof token === 'string' ? token : '', ctx.req.headers.get('CF-Connecting-IP'), action)
  if (!ok) fail('captcha_failed', 'Security verification failed', 403)
}

export function registerAuthRoutes(r: Router) {
  r.on('POST', '/api/auth/register/options', async (ctx) => {
    const d = db(ctx.env)
    const b = await body(ctx.req)
    const settings = await getSettings(d)
    if (!settings.registrations_enabled || settings.maintenance_mode) return fail('registrations_closed', 'Registrations are closed', 403)
    await guard(ctx, 'register', 5, 3600)
    await requireTurnstile(ctx, b.turnstileToken, 'register')

    const displayName = str(b.displayName, 100)
    const brandName = str(b.brandName, 100)
    const email = str(b.email, 254).toLowerCase()
    const purpose = oneOf(b.purpose, PURPOSES)
    const language = oneOf(b.language, ['tr', 'en'] as const, 'tr')!
    const fields: string[] = []
    if (displayName.length < 2) fields.push('displayName')
    if (email && !EMAIL_RE.test(email)) fields.push('email')
    if (!purpose) fields.push('purpose')
    if (b.acceptTerms !== true) fields.push('acceptTerms')
    if (fields.length) return fail('validation_error', 'Invalid fields', 400, { fields })

    const rp = webauthnOrigin(ctx)
    const userId = uuid()
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rp.rpID,
      userID: new Uint8Array(new TextEncoder().encode(userId)),
      userName: displayName,
      userDisplayName: displayName,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
      supportedAlgorithmIDs: [-7, -257],
    })
    const challengeId = await saveChallenge(d, 'register', options.challenge, rp, userId, {
      displayName,
      brandName: brandName || null,
      email: email || null,
      purpose,
      language,
    })
    return json({ challengeId, options })
  })

  r.on('POST', '/api/auth/register/verify', async (ctx) => {
    const d = db(ctx.env)
    const b = await body(ctx.req, 64 * 1024)
    const ch = await takeChallenge(d, b.challengeId, 'register')
    let verification
    try {
      verification = await verifyRegistrationResponse({
        response: b.response as RegistrationResponseJSON,
        expectedChallenge: ch.challenge,
        expectedOrigin: ch.origin,
        expectedRPID: ch.rp_id,
        requireUserVerification: false,
      })
    } catch {
      return fail('auth_failed', 'Passkey verification failed', 400)
    }
    if (!verification.verified || !verification.registrationInfo) return fail('auth_failed', 'Passkey verification failed', 400)
    const { credential } = verification.registrationInfo
    const p = JSON.parse(ch.payload ?? '{}') as { displayName: string; brandName: string | null; email: string | null; purpose: string; language: string }
    const userId = ch.user_id!
    const now = nowIso()
    try {
      await d.batch([
        d
          .prepare(
            'INSERT INTO users (id, display_name, brand_name, email, email_verified, purpose, role, status, language, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, ?8, ?9, ?9)',
          )
          // role/status are fixed here: nobody can make themselves admin at sign-up.
          .bind(userId, p.displayName, p.brandName, p.email, p.purpose, 'user', 'active', p.language, now),
        d
          .prepare('INSERT INTO passkeys (id, user_id, credential_id, public_key, counter, transports, name, created_at, last_used_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)')
          .bind(uuid(), userId, credential.id, b64url(credential.publicKey), credential.counter, JSON.stringify(credential.transports ?? []), str(b.passkeyName, 60) || null, now),
      ])
    } catch {
      return fail('conflict', 'This passkey is already registered', 409)
    }
    const recoveryCodes = await issueRecoveryCodes(d, ctx.env, userId)
    const setCookie = await createSession(d, userId)
    await audit(d, userId, 'user.registered', 'user', userId)
    const user = await d.prepare('SELECT *, NULL AS session_id FROM users WHERE id = ?1').bind(userId).first()
    return json({ user: publicUser(user as never), recoveryCodes }, 201, { 'Set-Cookie': setCookie })
  })

  r.on('POST', '/api/auth/login/options', async (ctx) => {
    const d = db(ctx.env)
    await guard(ctx, 'login', 30, 600)
    const rp = webauthnOrigin(ctx)
    // Discoverable credentials: no user identifier is asked for or revealed.
    const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: 'preferred' })
    const challengeId = await saveChallenge(d, 'login', options.challenge, rp, null)
    return json({ challengeId, options })
  })

  r.on('POST', '/api/auth/login/verify', async (ctx) => {
    const d = db(ctx.env)
    const b = await body(ctx.req, 64 * 1024)
    const ch = await takeChallenge(d, b.challengeId, 'login')
    const response = b.response as AuthenticationResponseJSON
    if (!response || typeof response.id !== 'string') return fail('validation_error', 'Invalid response', 400)
    const pk = await d
      .prepare('SELECT p.id, p.user_id, p.credential_id, p.public_key, p.counter, p.transports, u.status FROM passkeys p JOIN users u ON u.id = p.user_id WHERE p.credential_id = ?1')
      .bind(response.id)
      .first<{ id: string; user_id: string; credential_id: string; public_key: string; counter: number; transports: string | null; status: string }>()
    if (!pk) return fail('auth_failed', 'Unknown passkey', 400)
    let verification
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: ch.challenge,
        expectedOrigin: ch.origin,
        expectedRPID: ch.rp_id,
        credential: {
          id: pk.credential_id,
          publicKey: fromB64url(pk.public_key),
          counter: pk.counter,
          transports: JSON.parse(pk.transports ?? '[]') as AuthenticatorTransportFuture[],
        },
        requireUserVerification: false,
      })
    } catch {
      return fail('auth_failed', 'Passkey verification failed', 400)
    }
    if (!verification.verified) return fail('auth_failed', 'Passkey verification failed', 400)
    if (pk.status !== 'active') return fail('forbidden', 'Account suspended', 403)
    await d.prepare('UPDATE passkeys SET counter = ?1, last_used_at = ?2 WHERE id = ?3').bind(verification.authenticationInfo.newCounter, nowIso(), pk.id).run()
    const setCookie = await createSession(d, pk.user_id)
    const user = await d.prepare('SELECT *, NULL AS session_id FROM users WHERE id = ?1').bind(pk.user_id).first()
    return json({ user: publicUser(user as never) }, 200, { 'Set-Cookie': setCookie })
  })

  r.on('POST', '/api/auth/recovery', async (ctx) => {
    const d = db(ctx.env)
    await guard(ctx, 'recovery', 10, 3600)
    const b = await body(ctx.req)
    await requireTurnstile(ctx, b.turnstileToken, 'recovery')
    const code = normalizeRecoveryCode(str(b.code, 40))
    if (code.length !== 12) return fail('auth_failed', 'Invalid recovery code', 400)
    const hash = await sha256Hex(`${ctx.env.IP_HASH_SALT ?? ''}:rc:${code}`)
    const row = await d
      .prepare(
        `UPDATE recovery_codes SET used_at = ?1 WHERE code_hash = ?2 AND used_at IS NULL
           AND user_id IN (SELECT id FROM users WHERE status = 'active') RETURNING user_id`,
      )
      .bind(nowIso(), hash)
      .first<{ user_id: string }>()
    if (!row) return fail('auth_failed', 'Invalid recovery code', 400)
    const setCookie = await createSession(d, row.user_id)
    await audit(d, row.user_id, 'auth.recovery_code_used', 'user', row.user_id)
    const remaining = await d.prepare('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ?1 AND used_at IS NULL').bind(row.user_id).first<{ n: number }>()
    const user = await d.prepare('SELECT *, NULL AS session_id FROM users WHERE id = ?1').bind(row.user_id).first()
    return json({ user: publicUser(user as never), remainingCodes: remaining?.n ?? 0 }, 200, { 'Set-Cookie': setCookie })
  })

  r.on('POST', '/api/auth/logout', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx).catch(() => null)
    if (user) await d.prepare('UPDATE sessions SET revoked_at = ?1 WHERE id = ?2').bind(nowIso(), user.session_id).run()
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() })
  })

  r.on('GET', '/api/auth/me', async (ctx) => {
    db(ctx.env)
    const user = await requireUser(ctx)
    return json({ user: publicUser(user) })
  })

  // --- Passkey management (signed in) ---
  r.on('GET', '/api/auth/passkeys', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const { results } = await d
      .prepare('SELECT id, name, created_at AS createdAt, last_used_at AS lastUsedAt FROM passkeys WHERE user_id = ?1 ORDER BY created_at')
      .bind(user.id)
      .all()
    const codes = await d.prepare('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ?1 AND used_at IS NULL').bind(user.id).first<{ n: number }>()
    return json({ passkeys: results, remainingRecoveryCodes: codes?.n ?? 0 })
  })

  r.on('POST', '/api/auth/passkeys/options', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const rp = webauthnOrigin(ctx)
    const { results } = await d.prepare('SELECT credential_id, transports FROM passkeys WHERE user_id = ?1').bind(user.id).all<{ credential_id: string; transports: string | null }>()
    if (results.length >= 10) return fail('validation_error', 'Passkey limit reached', 400)
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rp.rpID,
      userID: new Uint8Array(new TextEncoder().encode(user.id)),
      userName: user.display_name,
      userDisplayName: user.display_name,
      attestationType: 'none',
      excludeCredentials: results.map((c) => ({ id: c.credential_id, transports: JSON.parse(c.transports ?? '[]') })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
      supportedAlgorithmIDs: [-7, -257],
    })
    const challengeId = await saveChallenge(d, 'add_passkey', options.challenge, rp, user.id)
    return json({ challengeId, options })
  })

  r.on('POST', '/api/auth/passkeys/verify', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const b = await body(ctx.req, 64 * 1024)
    const ch = await takeChallenge(d, b.challengeId, 'add_passkey')
    if (ch.user_id !== user.id) return fail('forbidden', 'Challenge belongs to another user', 403)
    let verification
    try {
      verification = await verifyRegistrationResponse({
        response: b.response as RegistrationResponseJSON,
        expectedChallenge: ch.challenge,
        expectedOrigin: ch.origin,
        expectedRPID: ch.rp_id,
        requireUserVerification: false,
      })
    } catch {
      return fail('auth_failed', 'Passkey verification failed', 400)
    }
    if (!verification.verified || !verification.registrationInfo) return fail('auth_failed', 'Passkey verification failed', 400)
    const { credential } = verification.registrationInfo
    const id = uuid()
    try {
      await d
        .prepare('INSERT INTO passkeys (id, user_id, credential_id, public_key, counter, transports, name, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
        .bind(id, user.id, credential.id, b64url(credential.publicKey), credential.counter, JSON.stringify(credential.transports ?? []), str(b.name, 60) || null, nowIso())
        .run()
    } catch {
      return fail('conflict', 'This passkey is already registered', 409)
    }
    await audit(d, user.id, 'auth.passkey_added', 'passkey', id)
    return json({ id }, 201)
  })

  r.on('DELETE', '/api/auth/passkeys/:id', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const n = await d.prepare('SELECT COUNT(*) AS n FROM passkeys WHERE user_id = ?1').bind(user.id).first<{ n: number }>()
    if ((n?.n ?? 0) <= 1) return fail('validation_error', 'You cannot remove your only passkey', 400)
    const res = await d.prepare('DELETE FROM passkeys WHERE id = ?1 AND user_id = ?2').bind(ctx.params.id, user.id).run()
    if (!res.meta.changes) return fail('not_found', 'Passkey not found', 404)
    await audit(d, user.id, 'auth.passkey_removed', 'passkey', ctx.params.id)
    return json({ ok: true })
  })

  r.on('POST', '/api/auth/recovery-codes', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const recoveryCodes = await issueRecoveryCodes(d, ctx.env, user.id)
    await audit(d, user.id, 'auth.recovery_codes_regenerated', 'user', user.id)
    return json({ recoveryCodes })
  })
}
