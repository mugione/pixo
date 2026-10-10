import { dictionaries } from '../i18n'
import { LANGS, NOINDEX_PAGES, pagePath, type Lang, type PageId } from '../i18n/routes'
import { SITE_NAME, SITE_URL } from './site'

export type HeadData = {
  lang: Lang
  title: string
  description: string
  canonical: string
  alternates: { hreflang: string; href: string }[]
  noindex: boolean
  ogLocale: string
  jsonLd: object[]
}

const OG_LOCALE: Record<Lang, string> = { tr: 'tr_TR', en: 'en_US' }

export function buildHead(lang: Lang, page: PageId | 'notFound' | 'app'): HeadData {
  const t = dictionaries[lang]
  const seo = t.seo[page]
  const isPage = page !== 'notFound' && page !== 'app'
  const canonical = isPage ? SITE_URL + pagePath(lang, page) : SITE_URL + (page === 'app' ? '/app' : '/')
  const alternates = isPage
    ? [
        ...LANGS.map((l) => ({ hreflang: l, href: SITE_URL + pagePath(l, page) })),
        { hreflang: 'x-default', href: SITE_URL + pagePath('tr', page) },
      ]
    : []
  const jsonLd: object[] = []
  if (page === 'home') {
    jsonLd.push(
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/logo.svg`,
        slogan: 'Create smarter. Market faster.',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        inLanguage: ['tr-TR', 'en'],
      },
    )
  }
  if (page === 'faq') {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: t.faq.items.map((i) => ({
        '@type': 'Question',
        name: i.q,
        acceptedAnswer: { '@type': 'Answer', text: i.a },
      })),
    })
  }
  return {
    lang,
    title: seo.title,
    description: seo.description,
    canonical,
    alternates,
    noindex: !isPage || NOINDEX_PAGES.has(page),
    ogLocale: OG_LOCALE[lang],
    jsonLd,
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Serialises head tags for static prerendering. */
export function renderHeadTags(h: HeadData): string {
  const tags = [
    `<title>${esc(h.title)}</title>`,
    `<meta name="description" content="${esc(h.description)}" />`,
    `<meta name="robots" content="${h.noindex ? 'noindex, nofollow' : 'index, follow'}" />`,
    `<link rel="canonical" href="${h.canonical}" />`,
    ...h.alternates.map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`),
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(h.title)}" />`,
    `<meta property="og:description" content="${esc(h.description)}" />`,
    `<meta property="og:url" content="${h.canonical}" />`,
    `<meta property="og:locale" content="${h.ogLocale}" />`,
    `<meta property="og:image" content="${SITE_URL}/og-image.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(h.title)}" />`,
    `<meta name="twitter:description" content="${esc(h.description)}" />`,
    `<meta name="twitter:image" content="${SITE_URL}/og-image.png" />`,
    ...h.jsonLd.map(
      (j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`,
    ),
  ]
  return tags.join('\n    ')
}
