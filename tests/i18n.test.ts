import { describe, expect, it } from 'vitest'
import { en } from '../src/i18n/en'
import { tr } from '../src/i18n/tr'
import { LANGS, PAGES, localePath, pageIdForPath, pagePath, splitLang } from '../src/i18n/routes'

type Shape = string | number | boolean | null | Shape[] | { [k: string]: Shape }

function shape(v: unknown): Shape {
  if (Array.isArray(v)) return v.map(shape)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]))
  return typeof v === 'string' ? 'string' : (v as Shape)
}

function strings(v: unknown, path = ''): [string, string][] {
  if (typeof v === 'string') return [[path, v]]
  if (Array.isArray(v)) return v.flatMap((x, i) => strings(x, `${path}[${i}]`))
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => strings(x, path ? `${path}.${k}` : k))
  return []
}

// Fields that are intentionally empty for some items (optional sub-content).
const OPTIONAL = /\.(note|listTitle)$/

describe('dictionaries', () => {
  it('EN has exactly the same structure as TR (incl. array lengths)', () => {
    expect(shape(en)).toEqual(shape(tr))
  })

  it('has no empty required strings', () => {
    for (const d of [tr, en]) {
      const empty = strings(d).filter(([p, s]) => !s.trim() && !OPTIONAL.test(p))
      expect(empty).toEqual([])
    }
  })

  it('uses the same {placeholders} in both languages', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')
    const enMap = new Map(strings(en))
    for (const [p, s] of strings(tr)) expect(ph(enMap.get(p) ?? ''), p).toBe(ph(s))
  })

  it('every SEO title/description stays within search-friendly lengths', () => {
    for (const d of [tr, en]) {
      for (const [k, v] of Object.entries(d.seo)) {
        expect(v.title.length, `${k} title`).toBeLessThanOrEqual(70)
        expect(v.description.length, `${k} description`).toBeLessThanOrEqual(170)
      }
    }
  })
})

describe('routes', () => {
  it('maps pages to localised paths and back', () => {
    for (const lang of LANGS) {
      for (const id of Object.keys(PAGES) as (keyof typeof PAGES)[]) {
        const url = pagePath(lang, id)
        const { lang: l, path } = splitLang(url)
        expect(l).toBe(lang)
        expect(pageIdForPath(path)).toBe(id)
      }
    }
  })

  it('handles trailing slashes and the /en root', () => {
    expect(splitLang('/en/')).toEqual({ lang: 'en', path: '/' })
    expect(splitLang('/pricing/')).toEqual({ lang: 'tr', path: '/pricing' })
    expect(splitLang('/english')).toEqual({ lang: 'tr', path: '/english' })
    expect(localePath('en', '/')).toBe('/en')
  })
})
