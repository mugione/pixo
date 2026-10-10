// Server-side validation of model output: malformed or incomplete JSON never reaches the UI.
import type { CampaignResult, TextResult } from '../../shared/options'

/** Extracts the first JSON object from model text (tolerates code fences / stray prose). */
export function extractJson(raw: string): unknown {
  const text = raw.replace(/```(?:json)?/gi, '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('no_json')
  return JSON.parse(text.slice(start, end + 1))
}

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const arr = (v: unknown) => (Array.isArray(v) ? v : [])

export function validateText(data: unknown): TextResult {
  const o = (data ?? {}) as Record<string, unknown>
  const variants = arr(o.variants)
    .map((v) => {
      const x = (v ?? {}) as Record<string, unknown>
      return {
        title: s(x.title, 200),
        body: s(x.body, 4000),
        cta: s(x.cta, 120),
        hashtags: arr(x.hashtags)
          .map((h) => s(h, 60).replace(/\s+/g, ''))
          .filter(Boolean)
          .map((h) => (h.startsWith('#') ? h : `#${h}`))
          .slice(0, 12),
      }
    })
    .filter((v) => v.body.length >= 10)
    .slice(0, 3)
  if (!variants.length) throw new Error('invalid_schema')
  return { variants }
}

export function validateCampaign(data: unknown): CampaignResult {
  const o = (data ?? {}) as Record<string, unknown>
  const out: CampaignResult = {
    name: s(o.name, 150),
    mainMessage: s(o.mainMessage, 600),
    headlines: arr(o.headlines).map((h) => s(h, 150)).filter(Boolean).slice(0, 3),
    socialCaptions: arr(o.socialCaptions).map((h) => s(h, 1500)).filter(Boolean).slice(0, 2),
    shortDescription: s(o.shortDescription, 800),
    cta: s(o.cta, 120),
    visualConcept: s(o.visualConcept, 800),
    schedule: arr(o.schedule)
      .map((x) => {
        const r = (x ?? {}) as Record<string, unknown>
        return { day: s(r.day, 60), channel: s(r.channel, 60), content: s(r.content, 400) }
      })
      .filter((r) => r.day && r.content)
      .slice(0, 10),
  }
  const complete =
    out.name && out.mainMessage && out.headlines.length === 3 && out.socialCaptions.length === 2 && out.shortDescription && out.cta && out.visualConcept && out.schedule.length >= 1
  if (!complete) throw new Error('invalid_schema')
  return out
}
