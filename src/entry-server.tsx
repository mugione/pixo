import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { App } from './App'
import { buildHead, renderHeadTags } from './lib/seo'
import { pageIdForPath, splitLang } from './i18n/routes'

export { LANGS, PAGES, NOINDEX_PAGES, pagePath } from './i18n/routes'

/** Renders one URL to `{ html, head, lang }` for static prerendering (scripts/prerender.mjs). */
export function render(url: string) {
  const { lang, path } = splitLang(url)
  const page = url === '/app' || url.startsWith('/app/') ? 'app' : (pageIdForPath(path) ?? 'notFound')
  const html = renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </StrictMode>,
  )
  return { html, head: renderHeadTags(buildHead(lang, page)), lang }
}
