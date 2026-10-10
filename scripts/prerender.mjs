// Prerenders every public page (TR + EN) to static HTML, then writes 404.html, sitemap.xml,
// robots.txt and the _headers file (security headers + CSP hash of the inline theme script).
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const dist = join(root, 'dist')
const SITE_URL = 'https://pixo.tr'

const template = await readFile(join(dist, 'index.html'), 'utf8')
const ssr = await import(pathToFileURL(join(root, 'dist-ssr', 'entry-server.js')).href)
const { render, LANGS, PAGES, NOINDEX_PAGES, pagePath } = ssr

function page(url) {
  const { html, head, lang } = render(url)
  return template.replace('<html lang="tr">', `<html lang="${lang}">`).replace('<!--head-->', head).replace('<!--app-->', html)
}

async function write(file, content) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, content)
}

const written = []
for (const lang of LANGS) {
  for (const id of Object.keys(PAGES)) {
    const url = pagePath(lang, id)
    const file = url === '/' ? join(dist, 'index.html') : join(dist, url.slice(1), 'index.html')
    await write(file, page(url))
    written.push(url)
  }
}
// Workers Static Assets serves the nearest 404.html, so /en/* gets an English 404 page.
await write(join(dist, '404.html'), page('/__not-found__'))
await write(join(dist, 'en', '404.html'), page('/en/__not-found__'))

// sitemap.xml with hreflang alternates (noindex pages excluded)
const today = new Date().toISOString().slice(0, 10)
const urls = Object.keys(PAGES)
  .filter((id) => !NOINDEX_PAGES.has(id))
  .flatMap((id) =>
    LANGS.map((lang) => {
      const alts = LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE_URL}${pagePath(l, id)}"/>`)
      alts.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${pagePath('tr', id)}"/>`)
      return `  <url>\n    <loc>${SITE_URL}${pagePath(lang, id)}</loc>\n    <lastmod>${today}</lastmod>\n${alts.join('\n')}\n  </url>`
    }),
  )
await write(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`,
)

await write(
  join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /app\nDisallow: /admin\nDisallow: /signup\nDisallow: /en/signup\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
)

// Security headers. The CSP allows exactly one inline script (theme bootstrap) via its hash.
const inline = [...template.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
const hashes = inline.map((s) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`)
const csp = [
  "default-src 'self'",
  `script-src 'self' ${hashes.join(' ')} https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  'frame-src https://challenges.cloudflare.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')
await write(
  join(dist, '_headers'),
  `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`,
)

await rm(join(root, 'dist-ssr'), { recursive: true, force: true })
console.log(`prerendered ${written.length} pages + 2× 404.html, sitemap.xml, robots.txt, _headers`)
