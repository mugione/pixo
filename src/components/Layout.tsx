import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'
import { I18nProvider, useI18n } from '../i18n'
import { pageIdForPath, splitLang } from '../i18n/routes'
import { buildHead } from '../lib/seo'
import { Footer } from './Footer'
import { Header } from './Header'

/** Keeps <head> in sync during client-side navigation (prerendered HTML already has it). */
function HeadSync() {
  const { lang } = useI18n()
  const { pathname, hash } = useLocation()
  useEffect(() => {
    const page = pageIdForPath(splitLang(pathname).path) ?? 'notFound'
    const h = buildHead(lang, page)
    document.documentElement.lang = lang
    document.title = h.title
    const set = (sel: string, attr: string, val: string) => document.querySelector(sel)?.setAttribute(attr, val)
    set('meta[name="description"]', 'content', h.description)
    set('meta[name="robots"]', 'content', h.noindex ? 'noindex, nofollow' : 'index, follow')
    set('link[rel="canonical"]', 'href', h.canonical)
    set('meta[property="og:title"]', 'content', h.title)
    set('meta[property="og:description"]', 'content', h.description)
    set('meta[property="og:url"]', 'content', h.canonical)
    for (const a of h.alternates) set(`link[rel="alternate"][hreflang="${a.hreflang}"]`, 'href', a.href)
  }, [lang, pathname])
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false // keep the browser's own scroll restoration on initial load
      return
    }
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export function Layout() {
  const { pathname } = useLocation()
  const { lang } = splitLang(pathname)
  return (
    <I18nProvider lang={lang}>
      <HeadSync />
      <SkipLink />
      <div className="flex min-h-dvh flex-col">
        <Header />
        <main id="main" className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </I18nProvider>
  )
}

function SkipLink() {
  const { t } = useI18n()
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
    >
      {t.common.skipToContent}
    </a>
  )
}
