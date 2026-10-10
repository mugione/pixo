import type { Ctx } from './router'
import { fail, getCookie } from './http'
import { nowIso, randomToken, sha256Hex, uuid } from './util'

export const SESSION_COOKIE = '__Host-pixo_session'
const SESSION_DAYS = 30

export type SessionUser = {
  id: string
  display_name: string
  brand_name: string | null
  email: string | null
  email_verified: number
  purpose: string | null
  role: 'user' | 'admin'
  status: 'active' | 'suspended'
  language: 'tr' | 'en'
  onboarded: number
  text_limit_override: number | null
  image_limit_override: number | null
  created_at: string
  session_id: string
}

function cookie(value: string, maxAge: number): string {
  // __Host- prefix: Secure, Path=/, no Domain → bound to this exact host.
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}
export const clearSessionCookie = () => cookie('', 0)

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const token = randomToken(32)
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString()
  await db
    .prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(uuid(), userId, await sha256Hex(token), expires, nowIso())
    .run()
  return cookie(token, SESSION_DAYS * 86400)
}

export async function currentUser(ctx: Ctx): Promise<SessionUser | null> {
  const token = getCookie(ctx.req, SESSION_COOKIE)
  if (!token || !ctx.env.DB) return null
  const row = await ctx.env.DB.prepare(
    `SELECT u.id, u.display_name, u.brand_name, u.email, u.email_verified, u.purpose, u.role, u.status, u.language,
            u.onboarded, u.text_limit_override, u.image_limit_override, u.created_at, s.id AS session_id
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?1 AND s.revoked_at IS NULL AND s.expires_at > ?2`,
  )
    .bind(await sha256Hex(token), nowIso())
    .first<SessionUser>()
  return row ?? null
}

/** Returns the signed-in, active user or throws 401/403. */
export async function requireUser(ctx: Ctx): Promise<SessionUser> {
  const user = await currentUser(ctx)
  if (!user) return fail('unauthorized', 'Sign-in required', 401)
  if (user.status !== 'active') return fail('forbidden', 'Account suspended', 403)
  return user
}

export async function requireAdmin(ctx: Ctx): Promise<SessionUser> {
  const user = await requireUser(ctx)
  if (user.role !== 'admin') return fail('forbidden', 'Admin only', 403)
  return user
}

export function publicUser(u: SessionUser) {
  return {
    id: u.id,
    displayName: u.display_name,
    brandName: u.brand_name,
    email: u.email,
    emailVerified: !!u.email_verified,
    purpose: u.purpose,
    role: u.role,
    language: u.language,
    onboarded: !!u.onboarded,
    createdAt: u.created_at,
  }
}

export async function audit(db: D1Database, actor: string | null, event: string, resourceType?: string, resourceId?: string, metadata?: object) {
  await db
    .prepare('INSERT INTO audit_logs (id, actor_user_id, event_type, resource_type, resource_id, metadata, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
    .bind(uuid(), actor, event, resourceType ?? null, resourceId ?? null, metadata ? JSON.stringify(metadata) : null, nowIso())
    .run()
}
