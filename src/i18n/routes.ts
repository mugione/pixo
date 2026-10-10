export const LANGS = ['tr', 'en'] as const
export type Lang = (typeof LANGS)[number]
export const DEFAULT_LANG: Lang = 'tr'

/** Public pages. Turkish lives at the root, English under /en. */
export const PAGES = {
  home: '/',
  features: '/features',
  howItWorks: '/how-it-works',
  solutions: '/solutions',
  pricing: '/pricing',
  about: '/about',
  roadmap: '/roadmap',
  faq: '/faq',
  contact: '/contact',
  demo: '/demo',
  privacy: '/privacy',
  terms: '/terms',
  cookies: '/cookies',
  kvkk: '/kvkk',
  signup: '/signup',
  login: '/login',
} as const

export type PageId = keyof typeof PAGES

/** Pages excluded from search indexes and the sitemap. */
export const NOINDEX_PAGES: ReadonlySet<PageId> = new Set<PageId>(['signup', 'login'])

export function localePath(lang: Lang, path: string): string {
  if (lang === DEFAULT_LANG) return path
  return path === '/' ? `/${lang}` : `/${lang}${path}`
}

export function pagePath(lang: Lang, page: PageId): string {
  return localePath(lang, PAGES[page])
}

/** Splits `/en/pricing` into `{ lang: 'en', path: '/pricing' }`. */
export function splitLang(pathname: string): { lang: Lang; path: string } {
  const clean = pathname.replace(/\/+$/, '') || '/'
  const m = clean.match(/^\/(en)(\/.*)?$/)
  if (m) return { lang: 'en', path: m[2] || '/' }
  return { lang: DEFAULT_LANG, path: clean }
}

export function pageIdForPath(path: string): PageId | undefined {
  return (Object.keys(PAGES) as PageId[]).find((id) => PAGES[id] === path)
}
