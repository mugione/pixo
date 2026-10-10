// AI endpoints: text, campaign and image generation with quotas, idempotency and safe failure.
import {
  ASPECTS,
  ASPECT_SIZES,
  CATEGORIES,
  CONTENT_TYPES,
  GOALS,
  LENGTHS,
  SCENES,
  STYLES,
  TONES,
  type ProjectType,
} from '../../shared/options'
import { campaignMessages, imagePrompt, textMessages, type BrandData } from '../ai/prompts'
import { generateImage, WorkersAiText } from '../ai/provider'
import { refund, reserve, type Kind } from '../ai/quota'
import { extractJson, validateCampaign, validateText } from '../ai/validate'
import type { AppEnv } from '../env'
import { body, fail, HttpError, json } from '../http'
import type { Ctx, Router } from '../router'
import { getSettings, type Settings } from '../settings'
import { requireUser, type SessionUser } from '../session'
import { fromB64url, nextUtcMidnight, nowIso, oneOf, str, todayUtc, uuid } from '../util'
import { db } from './auth'

const MAX_TOKENS = { short: 1500, medium: 2500, long: 3500 } as const
const PENDING_WINDOW_MS = 3 * 60_000
const MAX_REFERENCE_BYTES = 1024 * 1024
const MAX_REFERENCE_PX = 512

const TEXT_SCHEMA = {
  type: 'object',
  properties: {
    variants: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, body: { type: 'string' }, cta: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } } },
        required: ['title', 'body', 'cta', 'hashtags'],
      },
    },
  },
  required: ['variants'],
}
const CAMPAIGN_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    mainMessage: { type: 'string' },
    headlines: { type: 'array', items: { type: 'string' } },
    socialCaptions: { type: 'array', items: { type: 'string' } },
    shortDescription: { type: 'string' },
    cta: { type: 'string' },
    visualConcept: { type: 'string' },
    schedule: {
      type: 'array',
      items: { type: 'object', properties: { day: { type: 'string' }, channel: { type: 'string' }, content: { type: 'string' } }, required: ['day', 'channel', 'content'] },
    },
  },
  required: ['name', 'mainMessage', 'headlines', 'socialCaptions', 'shortDescription', 'cta', 'visualConcept', 'schedule'],
}

function ai(env: AppEnv): Ai {
  if (!env.AI) return fail('unavailable', 'AI binding not configured', 503)
  return env.AI
}

async function loadBrand(d: D1Database, userId: string, brandId: unknown): Promise<{ id: string | null; data: BrandData }> {
  if (typeof brandId !== 'string' || !brandId) return { id: null, data: null }
  const b = await d
    .prepare(
      `SELECT id, name, description, industry, target_audience AS targetAudience, tone, slogan,
              preferred_phrases AS preferredPhrases, avoided_phrases AS avoidedPhrases
         FROM brands WHERE id = ?1 AND user_id = ?2`,
    )
    .bind(brandId, userId)
    .first<{ id: string } & NonNullable<BrandData>>()
  if (!b) return fail('validation_error', 'Invalid brand', 400, { fields: ['brandId'] })
  const { id, ...data } = b
  return { id, data }
}

type GenResult = { stored: string; payload: Record<string, unknown> }

/**
 * Shared lifecycle for every AI request:
 * kill-switch → idempotency → one-at-a-time → quota reservation → call → record or refund.
 */
async function runGeneration(
  ctx: Ctx,
  user: SessionUser,
  settings: Settings,
  kind: Kind,
  genType: ProjectType,
  model: string,
  call: (generationId: string) => Promise<GenResult>,
): Promise<Response> {
  const d = db(ctx.env)
  if (!settings.ai_enabled || settings.maintenance_mode) return fail('ai_disabled', 'AI service is turned off', 503)

  const key = str(ctx.req.headers.get('Idempotency-Key'), 64)
  if (key.length < 8) return fail('validation_error', 'Idempotency-Key header required', 400, { fields: ['idempotencyKey'] })
  const existing = await d
    .prepare('SELECT id, request_status, output_text FROM generations WHERE user_id = ?1 AND idempotency_key = ?2')
    .bind(user.id, key)
    .first<{ id: string; request_status: string; output_text: string | null }>()
  if (existing) return fail('conflict', `Request already ${existing.request_status}`, 409)

  const busy = await d
    .prepare("SELECT 1 FROM generations WHERE user_id = ?1 AND request_status = 'pending' AND created_at > ?2 LIMIT 1")
    .bind(user.id, new Date(Date.now() - PENDING_WINDOW_MS).toISOString())
    .first()
  if (busy) return fail('rate_limited', 'Another AI request is still running', 429)

  const reservation = await reserve(d, user, settings, kind)
  const generationId = uuid()
  try {
    await d
      .prepare(
        `INSERT INTO generations (id, user_id, provider, model, generation_type, request_status, idempotency_key, estimated_usage, usage_date_utc, created_at)
         VALUES (?1, ?2, 'cloudflare', ?3, ?4, 'pending', ?5, ?6, ?7, ?8)`,
      )
      .bind(generationId, user.id, model, genType, key, reservation.neurons, reservation.date, nowIso())
      .run()
  } catch {
    await refund(d, reservation) // lost a race on the same idempotency key
    return fail('conflict', 'Duplicate request', 409)
  }

  try {
    const { stored, payload } = await call(generationId)
    await d.prepare("UPDATE generations SET request_status = 'succeeded', output_text = ?2 WHERE id = ?1").bind(generationId, stored).run()
    return json({ generationId, ...payload }, 201)
  } catch (e) {
    const invalidOutput = e instanceof SyntaxError || (e instanceof Error && ['invalid_schema', 'no_json', 'empty_response', 'empty_image'].includes(e.message))
    const code = e instanceof HttpError ? 'validation' : invalidOutput ? 'invalid_output' : 'provider_error'
    console.error('ai_generation_failed', { generationId, kind, model, code, message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' })
    await d.prepare("UPDATE generations SET request_status = 'failed', error_code = ?2 WHERE id = ?1").bind(generationId, code).run()
    await refund(d, reservation)
    if (e instanceof HttpError) throw e
    return fail('ai_failed', 'The AI request could not be completed. Your quota was not used.', 502)
  }
}

async function upsertProject(
  d: D1Database,
  userId: string,
  projectId: unknown,
  type: ProjectType,
  title: string,
  brandId: string | null,
  update: (content: Record<string, unknown>) => Record<string, unknown>,
): Promise<string> {
  const now = nowIso()
  if (typeof projectId === 'string' && projectId) {
    const p = await d.prepare('SELECT content_json FROM projects WHERE id = ?1 AND user_id = ?2 AND type = ?3').bind(projectId, userId, type).first<{ content_json: string }>()
    if (!p) return fail('not_found', 'Project not found', 404)
    const content = update(JSON.parse(p.content_json))
    await d.prepare("UPDATE projects SET content_json = ?3, status = CASE WHEN status = 'draft' THEN 'in_progress' ELSE status END, updated_at = ?4 WHERE id = ?1 AND user_id = ?2")
      .bind(projectId, userId, JSON.stringify(content), now)
      .run()
    return projectId
  }
  const id = uuid()
  await d
    .prepare("INSERT INTO projects (id, user_id, brand_id, title, type, status, content_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, 'in_progress', ?6, ?7, ?7)")
    .bind(id, userId, brandId, title.slice(0, 150), type, JSON.stringify(update({})), now)
    .run()
  return id
}

/** Validates an optional target project BEFORE spending any AI quota. */
async function assertProject(d: D1Database, userId: string, projectId: unknown, type: ProjectType) {
  if (projectId == null || projectId === '') return
  if (typeof projectId !== 'string') fail('validation_error', 'Invalid project', 400, { fields: ['projectId'] })
  const ok = await d.prepare('SELECT 1 FROM projects WHERE id = ?1 AND user_id = ?2 AND type = ?3').bind(projectId, userId, type).first()
  if (!ok) fail('not_found', 'Project not found', 404)
}

/** Reads width/height from PNG or JPEG headers without decoding the image. */
export function imageSize(b: Uint8Array): { mime: string; width: number; height: number } | null {
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const v = new DataView(b.buffer, b.byteOffset)
    return { mime: 'image/png', width: v.getUint32(16), height: v.getUint32(20) }
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null
      const marker = b[i + 1]
      const len = (b[i + 2] << 8) | b[i + 3]
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { mime: 'image/jpeg', height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] }
      }
      i += 2 + len
    }
  }
  return null
}

export function registerAiRoutes(r: Router) {
  r.on('GET', '/api/ai/usage', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const s = await getSettings(d)
    const date = todayUtc()
    const [u, g] = await d.batch([
      d.prepare('SELECT text_requests, image_requests, last_used_at FROM usage_daily WHERE user_id = ?1 AND usage_date_utc = ?2').bind(user.id, date),
      d.prepare('SELECT estimated_neurons FROM global_usage_daily WHERE usage_date_utc = ?1').bind(date),
    ])
    const ur = (u.results[0] as { text_requests: number; image_requests: number; last_used_at: string | null } | undefined) ?? {
      text_requests: 0,
      image_requests: 0,
      last_used_at: null,
    }
    const used = (g.results[0] as { estimated_neurons: number } | undefined)?.estimated_neurons ?? 0
    const textLimit = user.text_limit_override ?? s.user_daily_text_limit
    const imageLimit = user.image_limit_override ?? s.user_daily_image_limit
    return json({
      date,
      text: { used: ur.text_requests, limit: textLimit, remaining: Math.max(0, textLimit - ur.text_requests) },
      image: { used: ur.image_requests, limit: imageLimit, remaining: Math.max(0, imageLimit - ur.image_requests) },
      lastUsedAt: ur.last_used_at,
      resetsAt: nextUtcMidnight(),
      aiEnabled: s.ai_enabled && !s.maintenance_mode && !!ctx.env.AI,
      systemCapacity: {
        text: used + s.text_neurons_estimate <= s.global_daily_neuron_budget,
        image: used + s.image_neurons_estimate <= s.global_daily_neuron_budget,
      },
      maxUploadMb: s.max_upload_mb,
      announcement: s.announcement || null,
    })
  })

  r.on('POST', '/api/ai/generate-text', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const s = await getSettings(d)
    const b = await body(ctx.req)
    const p = (b.product ?? {}) as Record<string, unknown>
    const input = {
      product: { name: str(p.name, 150), description: str(p.description, 2000), category: oneOf(p.category, CATEGORIES, 'other')! },
      audience: str(b.audience, 300),
      goal: oneOf(b.goal, GOALS),
      contentType: oneOf(b.contentType, CONTENT_TYPES),
      tone: oneOf(b.tone, TONES),
      language: oneOf(b.language, ['tr', 'en'] as const, 'tr')!,
      length: oneOf(b.length, LENGTHS, 'medium')!,
    }
    const fields: string[] = []
    if (input.product.name.length < 2) fields.push('productName')
    if (input.product.description.length < 10) fields.push('productDescription')
    if (!input.goal) fields.push('goal')
    if (!input.contentType) fields.push('contentType')
    if (!input.tone) fields.push('tone')
    if (fields.length) return fail('validation_error', 'Invalid fields', 400, { fields })
    const brand = await loadBrand(d, user.id, b.brandId)
    const title = str(b.title, 150) || input.product.name
    await assertProject(d, user.id, b.projectId, 'text')
    const engine = new WorkersAiText(ai(ctx.env), s.text_model)

    return runGeneration(ctx, user, s, 'text', 'text', s.text_model, async (generationId) => {
      const raw = await engine.complete(textMessages({ ...input, goal: input.goal!, contentType: input.contentType!, tone: input.tone!, brand: brand.data }) as never, {
        maxTokens: MAX_TOKENS[input.length],
        schema: TEXT_SCHEMA,
      })
      const result = validateText(extractJson(raw))
      const projectId = await upsertProject(d, user.id, b.projectId, 'text', title, brand.id, (c) => ({
        ...c,
        input: { ...input, brandId: brand.id },
        results: [{ generationId, createdAt: nowIso(), variants: result.variants }, ...((c.results as unknown[]) ?? [])].slice(0, 20),
      }))
      await d.prepare('UPDATE generations SET project_id = ?2 WHERE id = ?1').bind(generationId, projectId).run()
      return { stored: JSON.stringify(result), payload: { projectId, result } }
    })
  })

  r.on('POST', '/api/ai/generate-campaign', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const s = await getSettings(d)
    const b = await body(ctx.req)
    const input = {
      name: str(b.name, 150),
      product: str(b.product, 2000),
      audience: str(b.audience, 300),
      goal: oneOf(b.goal, GOALS),
      duration: str(b.duration, 60),
      language: oneOf(b.language, ['tr', 'en'] as const, 'tr')!,
      tone: oneOf(b.tone, TONES),
      highlights: str(b.highlights, 1000),
    }
    const fields: string[] = []
    if (input.name.length < 2) fields.push('name')
    if (input.product.length < 10) fields.push('product')
    if (input.audience.length < 3) fields.push('audience')
    if (!input.goal) fields.push('goal')
    if (!input.tone) fields.push('tone')
    if (fields.length) return fail('validation_error', 'Invalid fields', 400, { fields })
    const brand = await loadBrand(d, user.id, b.brandId)
    await assertProject(d, user.id, b.projectId, 'campaign')
    const engine = new WorkersAiText(ai(ctx.env), s.text_model)

    // One structured request for the whole package (no chained calls).
    return runGeneration(ctx, user, s, 'text', 'campaign', s.text_model, async (generationId) => {
      const raw = await engine.complete(campaignMessages({ ...input, goal: input.goal!, tone: input.tone!, brand: brand.data }) as never, {
        maxTokens: 3500,
        schema: CAMPAIGN_SCHEMA,
      })
      const campaign = validateCampaign(extractJson(raw))
      const projectId = await upsertProject(d, user.id, b.projectId, 'campaign', input.name, brand.id, (c) => ({
        ...c,
        input: { ...input, brandId: brand.id },
        campaign,
        generationId,
      }))
      await d.prepare('UPDATE generations SET project_id = ?2 WHERE id = ?1').bind(generationId, projectId).run()
      return { stored: JSON.stringify(campaign), payload: { projectId, campaign } }
    })
  })

  r.on('POST', '/api/ai/generate-image', async (ctx) => {
    const d = db(ctx.env)
    const user = await requireUser(ctx)
    const s = await getSettings(d)
    const b = await body(ctx.req, Math.ceil(MAX_REFERENCE_BYTES * 1.4) + 8192)
    const input = {
      description: str(b.description, 500),
      scene: oneOf(b.scene, SCENES),
      style: oneOf(b.style, STYLES),
      aspect: oneOf(b.aspect, ASPECTS),
    }
    const fields: string[] = []
    if (input.description.length < 3) fields.push('description')
    if (!input.scene) fields.push('scene')
    if (!input.style) fields.push('style')
    if (!input.aspect) fields.push('aspect')

    let reference: { bytes: Uint8Array<ArrayBuffer>; mime: string } | undefined
    if (typeof b.referenceImage === 'string' && b.referenceImage) {
      let bytes: Uint8Array<ArrayBuffer>
      try {
        bytes = fromB64url(b.referenceImage.replace(/^data:image\/\w+;base64,/, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''))
      } catch {
        bytes = new Uint8Array(0)
      }
      const info = imageSize(bytes)
      // Only small JPEG/PNG references (the browser resizes before upload); never trust the declared type.
      if (!info || bytes.length > MAX_REFERENCE_BYTES || info.width > MAX_REFERENCE_PX || info.height > MAX_REFERENCE_PX || !info.width || !info.height) {
        fields.push('referenceImage')
      } else reference = { bytes, mime: info.mime }
    }
    if (fields.length) return fail('validation_error', 'Invalid fields', 400, { fields })

    const prompt = imagePrompt({ description: input.description, scene: input.scene!, style: input.style!, aspect: input.aspect!, hasReference: !!reference })
    const size = ASPECT_SIZES[input.aspect!]
    const binding = ai(ctx.env)
    const title = str(b.title, 150) || input.description.slice(0, 60)
    await assertProject(d, user.id, b.projectId, 'image')

    return runGeneration(ctx, user, s, 'image', 'image', s.image_model, async (generationId) => {
      const image = await generateImage(binding, s.image_model, { prompt, ...size, reference: reference?.bytes, referenceMime: reference?.mime })
      // The image itself is returned to the browser only (stored in IndexedDB there), never in D1.
      const projectId = await upsertProject(d, user.id, b.projectId, 'image', title, null, (c) => ({
        ...c,
        input: { ...input, usedReference: !!reference },
        images: [{ generationId, createdAt: nowIso(), aspect: input.aspect, width: size.width, height: size.height }, ...((c.images as unknown[]) ?? [])].slice(0, 50),
      }))
      await d.prepare('UPDATE generations SET project_id = ?2 WHERE id = ?1').bind(generationId, projectId).run()
      return { stored: prompt, payload: { projectId, image, width: size.width, height: size.height } }
    })
  })
}
