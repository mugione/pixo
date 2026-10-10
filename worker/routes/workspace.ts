// Brands, projects, profile, history and account — every query is scoped to the signed-in user.
import { PROJECT_STATUSES, PROJECT_TYPES } from '../../shared/options'
import { body, fail, json } from '../http'
import type { Router } from '../router'
import { getSettings } from '../settings'
import { audit, clearSessionCookie, publicUser, requireUser } from '../session'
import { nowIso, oneOf, str, todayUtc, uuid } from '../util'
import { db } from './auth'

const COLOR_RE = /^#[0-9a-fA-F]{6}$/
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/
const MAX_CONTENT_BYTES = 200 * 1024
const MAX_BRANDS = 20

function brandInput(b: Record<string, unknown>) {
  const v = {
    name: str(b.name, 100),
    description: str(b.description, 1000) || null,
    industry: str(b.industry, 100) || null,
    target_audience: str(b.targetAudience, 300) || null,
    primary_color: str(b.primaryColor, 7) || null,
    secondary_color: str(b.secondaryColor, 7) || null,
    slogan: str(b.slogan, 150) || null,
    tone: str(b.tone, 300) || null,
    language: oneOf(b.language, ['tr', 'en'] as const, 'tr')!,
    preferred_phrases: str(b.preferredPhrases, 500) || null,
    avoided_phrases: str(b.avoidedPhrases, 500) || null,
  }
  const fields: string[] = []
  if (v.name.length < 1) fields.push('name')
  if (v.primary_color && !COLOR_RE.test(v.primary_color)) fields.push('primaryColor')
  if (v.secondary_color && !COLOR_RE.test(v.secondary_color)) fields.push('secondaryColor')
  if (fields.length) fail('validation_error', 'Invalid fields', 400, { fields })
  return v
}

const BRAND_COLS = `id, name, description, industry, target_audience AS targetAudience, primary_color AS primaryColor,
  secondary_color AS secondaryColor, slogan, tone, language, preferred_phrases AS preferredPhrases,
  avoided_phrases AS avoidedPhrases, is_default AS isDefault, created_at AS createdAt, updated_at AS updatedAt`

const PROJECT_COLS = `id, brand_id AS brandId, title, type, status, created_at AS createdAt, updated_at AS updatedAt`

function contentJson(v: unknown): string {
  const s = JSON.stringify(v ?? {})
  if (new TextEncoder().encode(s).byteLength > MAX_CONTENT_BYTES) fail('payload_too_large', 'Project content too large', 413)
  return s
}

async function assertBrand(d: D1Database, userId: string, brandId: unknown): Promise<string | null> {
  if (brandId == null || brandId === '') return null
  if (typeof brandId !== 'string') return fail('validation_error', 'Invalid brand', 400, { fields: ['brandId'] })
  const ok = await d.prepare('SELECT 1 FROM brands WHERE id = ?1 AND user_id = ?2').bind(brandId, userId).first()
  if (!ok) return fail('validation_error', 'Invalid brand', 400, { fields: ['brandId'] })
  return brandId
}

export function registerWorkspaceRoutes(r: Router) {
  // ---------- Brands ----------
  r.on('GET', '/api/brands', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const { results } = await d.prepare(`SELECT ${BRAND_COLS} FROM brands WHERE user_id = ?1 ORDER BY is_default DESC, created_at`).bind(user.id).all()
    return json({ brands: results.map((b) => ({ ...b, isDefault: !!b.isDefault })) })
  })

  r.on('POST', '/api/brands', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const b = await body(ctx.req)
    const v = brandInput(b)
    const count = await d.prepare('SELECT COUNT(*) AS n FROM brands WHERE user_id = ?1').bind(user.id).first<{ n: number }>()
    if ((count?.n ?? 0) >= MAX_BRANDS) return fail('validation_error', 'Brand limit reached', 400)
    const id = uuid()
    const now = nowIso()
    const makeDefault = b.isDefault === true || (count?.n ?? 0) === 0
    await d.batch([
      ...(makeDefault ? [d.prepare('UPDATE brands SET is_default = 0 WHERE user_id = ?1').bind(user.id)] : []),
      d
        .prepare(
          `INSERT INTO brands (id, user_id, name, description, industry, target_audience, primary_color, secondary_color, slogan, tone, language,
             preferred_phrases, avoided_phrases, is_default, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15)`,
        )
        .bind(id, user.id, v.name, v.description, v.industry, v.target_audience, v.primary_color, v.secondary_color, v.slogan, v.tone, v.language,
          v.preferred_phrases, v.avoided_phrases, makeDefault ? 1 : 0, now),
    ])
    return json({ id }, 201)
  })

  r.on('PUT', '/api/brands/:id', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const b = await body(ctx.req)
    const v = brandInput(b)
    const stmts = []
    if (b.isDefault === true) stmts.push(d.prepare('UPDATE brands SET is_default = 0 WHERE user_id = ?1').bind(user.id))
    stmts.push(
      d
        .prepare(
          `UPDATE brands SET name = ?3, description = ?4, industry = ?5, target_audience = ?6, primary_color = ?7, secondary_color = ?8,
             slogan = ?9, tone = ?10, language = ?11, preferred_phrases = ?12, avoided_phrases = ?13,
             is_default = CASE WHEN ?14 = 1 THEN 1 ELSE is_default END, updated_at = ?15
           WHERE id = ?1 AND user_id = ?2`,
        )
        .bind(ctx.params.id, user.id, v.name, v.description, v.industry, v.target_audience, v.primary_color, v.secondary_color, v.slogan, v.tone,
          v.language, v.preferred_phrases, v.avoided_phrases, b.isDefault === true ? 1 : 0, nowIso()),
    )
    const res = await d.batch(stmts)
    if (!res[res.length - 1].meta.changes) return fail('not_found', 'Brand not found', 404)
    return json({ ok: true })
  })

  r.on('DELETE', '/api/brands/:id', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const res = await d.prepare('DELETE FROM brands WHERE id = ?1 AND user_id = ?2').bind(ctx.params.id, user.id).run()
    if (!res.meta.changes) return fail('not_found', 'Brand not found', 404)
    return json({ ok: true })
  })

  // ---------- Projects ----------
  r.on('GET', '/api/projects', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const q = str(ctx.url.searchParams.get('q'), 100)
    const type = oneOf(ctx.url.searchParams.get('type'), PROJECT_TYPES)
    const status = oneOf(ctx.url.searchParams.get('status'), PROJECT_STATUSES)
    const sort = oneOf(ctx.url.searchParams.get('sort'), ['updated', 'created', 'title'] as const, 'updated')
    const order = { updated: 'updated_at DESC', created: 'created_at DESC', title: 'title COLLATE NOCASE ASC' }[sort!]
    const where = ['user_id = ?1']
    const args: unknown[] = [user.id]
    if (q) {
      args.push(`%${q.replace(/[%_\\]/g, (c) => '\\' + c)}%`)
      where.push(`title LIKE ?${args.length} ESCAPE '\\'`)
    }
    if (type) {
      args.push(type)
      where.push(`type = ?${args.length}`)
    }
    if (status) {
      args.push(status)
      where.push(`status = ?${args.length}`)
    }
    const { results } = await d
      .prepare(`SELECT ${PROJECT_COLS} FROM projects WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 200`)
      .bind(...args)
      .all()
    return json({ projects: results })
  })

  r.on('POST', '/api/projects', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const b = await body(ctx.req, MAX_CONTENT_BYTES + 4096)
    const title = str(b.title, 150)
    const type = oneOf(b.type, PROJECT_TYPES)
    const status = oneOf(b.status, PROJECT_STATUSES, 'draft')!
    const fields: string[] = []
    if (!title) fields.push('title')
    if (!type) fields.push('type')
    if (fields.length) return fail('validation_error', 'Invalid fields', 400, { fields })
    const brandId = await assertBrand(d, user.id, b.brandId)
    const id = uuid()
    const now = nowIso()
    await d
      .prepare('INSERT INTO projects (id, user_id, brand_id, title, type, status, content_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)')
      .bind(id, user.id, brandId, title, type, status, contentJson(b.content), now)
      .run()
    return json({ id }, 201)
  })

  r.on('GET', '/api/projects/:id', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const p = await d
      .prepare(`SELECT ${PROJECT_COLS}, content_json FROM projects WHERE id = ?1 AND user_id = ?2`)
      .bind(ctx.params.id, user.id)
      .first<Record<string, unknown> & { content_json: string }>()
    if (!p) return fail('not_found', 'Project not found', 404)
    const { content_json, ...rest } = p
    return json({ project: { ...rest, content: JSON.parse(content_json) } })
  })

  r.on('PUT', '/api/projects/:id', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const b = await body(ctx.req, MAX_CONTENT_BYTES + 4096)
    const sets: string[] = []
    const args: unknown[] = [ctx.params.id, user.id]
    const add = (col: string, v: unknown) => {
      args.push(v)
      sets.push(`${col} = ?${args.length}`)
    }
    if ('title' in b) {
      const t = str(b.title, 150)
      if (!t) return fail('validation_error', 'Invalid fields', 400, { fields: ['title'] })
      add('title', t)
    }
    if ('status' in b) {
      const s = oneOf(b.status, PROJECT_STATUSES)
      if (!s) return fail('validation_error', 'Invalid fields', 400, { fields: ['status'] })
      add('status', s)
    }
    if ('brandId' in b) add('brand_id', await assertBrand(d, user.id, b.brandId))
    if ('content' in b) add('content_json', contentJson(b.content))
    add('updated_at', nowIso())
    const res = await d.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?1 AND user_id = ?2`).bind(...args).run()
    if (!res.meta.changes) return fail('not_found', 'Project not found', 404)
    return json({ ok: true })
  })

  r.on('DELETE', '/api/projects/:id', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const res = await d.prepare('DELETE FROM projects WHERE id = ?1 AND user_id = ?2').bind(ctx.params.id, user.id).run()
    if (!res.meta.changes) return fail('not_found', 'Project not found', 404)
    return json({ ok: true })
  })

  // ---------- User ----------
  r.on('GET', '/api/user/profile', async (ctx) => {
    db(ctx.env)
    return json({ user: publicUser(await requireUser(ctx)) })
  })

  r.on('PUT', '/api/user/profile', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const b = await body(ctx.req)
    const displayName = 'displayName' in b ? str(b.displayName, 100) : user.display_name
    const brandName = 'brandName' in b ? str(b.brandName, 100) || null : user.brand_name
    const email = 'email' in b ? str(b.email, 254).toLowerCase() || null : user.email
    const language = oneOf(b.language, ['tr', 'en'] as const, user.language)!
    const onboarded = b.onboarded === true ? 1 : user.onboarded
    const fields: string[] = []
    if (displayName.length < 2) fields.push('displayName')
    if (email && !EMAIL_RE.test(email)) fields.push('email')
    if (fields.length) return fail('validation_error', 'Invalid fields', 400, { fields })
    // A changed address is never considered verified.
    const verified = email === user.email ? user.email_verified : 0
    await d
      .prepare('UPDATE users SET display_name = ?2, brand_name = ?3, email = ?4, email_verified = ?5, language = ?6, onboarded = ?7, updated_at = ?8 WHERE id = ?1')
      .bind(user.id, displayName, brandName, email, verified, language, onboarded, nowIso())
      .run()
    return json({ ok: true })
  })

  r.on('GET', '/api/user/history', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const { results } = await d
      .prepare(
        `SELECT g.id, g.generation_type AS type, g.provider, g.model, g.request_status AS status, g.error_code AS errorCode,
                substr(g.output_text, 1, 400) AS preview, g.project_id AS projectId, p.title AS projectTitle, g.created_at AS createdAt
           FROM generations g LEFT JOIN projects p ON p.id = g.project_id
          WHERE g.user_id = ?1 ORDER BY g.created_at DESC LIMIT 100`,
      )
      .bind(user.id)
      .all()
    return json({ generations: results })
  })

  r.on('GET', '/api/user/stats', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const settings = await getSettings(d)
    const [projects, gens, campaigns, usage] = await d.batch([
      d.prepare('SELECT COUNT(*) AS n FROM projects WHERE user_id = ?1').bind(user.id),
      d.prepare("SELECT COUNT(*) AS n FROM generations WHERE user_id = ?1 AND request_status = 'succeeded'").bind(user.id),
      d.prepare("SELECT COUNT(*) AS n FROM projects WHERE user_id = ?1 AND type = 'campaign' AND status = 'completed'").bind(user.id),
      d.prepare('SELECT text_requests, image_requests FROM usage_daily WHERE user_id = ?1 AND usage_date_utc = ?2').bind(user.id, todayUtc()),
    ])
    const n = (r: D1Result) => ((r.results[0] as { n?: number })?.n ?? 0)
    const u = (usage.results[0] as { text_requests: number; image_requests: number } | undefined) ?? { text_requests: 0, image_requests: 0 }
    const textLimit = user.text_limit_override ?? settings.user_daily_text_limit
    const imageLimit = user.image_limit_override ?? settings.user_daily_image_limit
    const { results: recent } = await d
      .prepare(`SELECT ${PROJECT_COLS} FROM projects WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 5`)
      .bind(user.id)
      .all()
    return json({
      totalProjects: n(projects),
      generatedContent: n(gens),
      completedCampaigns: n(campaigns),
      remainingText: Math.max(0, textLimit - u.text_requests),
      remainingImage: Math.max(0, imageLimit - u.image_requests),
      recentProjects: recent,
    })
  })

  r.on('DELETE', '/api/user/account', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const b = await body(ctx.req)
    if (b.confirm !== 'DELETE') return fail('validation_error', 'Confirmation required', 400, { fields: ['confirm'] })
    // ON DELETE CASCADE removes passkeys, sessions, codes, brands, products, projects, generations and usage.
    await d.prepare('DELETE FROM users WHERE id = ?1').bind(user.id).run()
    await audit(d, null, 'user.deleted', 'user', user.id)
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() })
  })
}
