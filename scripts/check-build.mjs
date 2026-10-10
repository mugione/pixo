// Post-build checks on the prerendered output: SEO tags, i18n, indexing rules and secret leakage.
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

const dist = resolve(import.meta.dirname, '..', 'dist')
const SITE = 'https://pixo.tr'
const failures = []
const fail = (file, msg) => failures.push(`${file}: ${msg}`)

async function walk(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(p)))
    else out.push(p)
  }
  return out
}

const files = await walk(dist)
const htmlFiles = files.filter((f) => f.endsWith('.html'))
const noindexExpected = new Set(['signup/index.html', 'en/signup/index.html', '404.html', 'en/404.html'])

for (const f of htmlFiles) {
  const rel = relative(dist, f)
  const html = await readFile(f, 'utf8')
  const urlPath = rel === 'index.html' ? '/' : '/' + rel.replace(/\/?index\.html$/, '')
  const lang = urlPath === '/en' || urlPath.startsWith('/en/') ? 'en' : 'tr'
  const one = (re, what) => {
    const m = html.match(re)
    if (!m) fail(rel, `missing ${what}`)
    return m?.[1]
  }
  if (!html.includes(`<html lang="${lang}"`)) fail(rel, `html lang should be ${lang}`)
  const title = one(/<title>([^<]+)<\/title>/, '<title>')
  if (title && title.length > 70) fail(rel, `title too long (${title.length})`)
  one(/<meta name="description" content="([^"]+)"/, 'meta description')
  one(/<meta property="og:image" content="([^"]+)"/, 'og:image')
  one(/<meta name="twitter:card" content="([^"]+)"/, 'twitter:card')
  const robots = one(/<meta name="robots" content="([^"]+)"/, 'robots meta')
  const shouldNoindex = noindexExpected.has(rel)
  if (robots && robots.startsWith('noindex') !== shouldNoindex) fail(rel, `robots=${robots}`)
  if (!rel.endsWith('404.html')) {
    const canonical = one(/<link rel="canonical" href="([^"]+)"/, 'canonical')
    if (canonical && canonical !== SITE + urlPath) fail(rel, `canonical ${canonical} != ${SITE + urlPath}`)
    for (const hl of ['tr', 'en', 'x-default']) if (!html.includes(`hreflang="${hl}"`)) fail(rel, `missing hreflang ${hl}`)
  }
  const h1 = (html.match(/<h1[\s>]/g) || []).length
  if (h1 !== 1) fail(rel, `expected exactly one <h1>, found ${h1}`)
  if (/\bundefined\b|\[object Object\]|\{tbd\}|\{kvkk\}/.test(html.replace(/<script[\s\S]*?<\/script>/g, ''))) fail(rel, 'unrendered placeholder or undefined in markup')
  for (const img of html.match(/<img\b[^>]*>/g) || []) if (!/\balt=/.test(img)) fail(rel, `img without alt: ${img}`)
  if (!html.includes('<div id="root"><')) fail(rel, 'page was not prerendered')
}

// Sitemap: every indexable page, never noindex pages.
const sitemap = await readFile(join(dist, 'sitemap.xml'), 'utf8')
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
for (const f of htmlFiles) {
  const rel = relative(dist, f)
  if (noindexExpected.has(rel)) continue
  const url = SITE + (rel === 'index.html' ? '/' : '/' + rel.replace(/\/?index\.html$/, ''))
  if (!locs.includes(url)) fail('sitemap.xml', `missing ${url}`)
}
if (locs.some((l) => l.includes('/signup'))) fail('sitemap.xml', 'contains noindex page')

// Secrets must never reach the client bundle.
const SECRET_PATTERNS = [/1x0000000000000000000000000000000AA/, /TURNSTILE_SECRET_KEY/, /IP_HASH_SALT/, /sk-ant-[\w-]+/, /CLOUDFLARE_API_TOKEN/]
for (const f of files.filter((f) => /\.(js|html|css|json|txt|xml)$/.test(f))) {
  const text = await readFile(f, 'utf8')
  for (const re of SECRET_PATTERNS) if (re.test(text)) fail(relative(dist, f), `possible secret: ${re}`)
}

const headers = await readFile(join(dist, '_headers'), 'utf8')
for (const h of ['Content-Security-Policy', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy']) {
  if (!headers.includes(h)) fail('_headers', `missing ${h}`)
}

if (failures.length) {
  console.error(`✗ ${failures.length} build check(s) failed:\n` + failures.map((f) => '  - ' + f).join('\n'))
  process.exit(1)
}
console.log(`✓ build checks passed (${htmlFiles.length} HTML files, ${locs.length} sitemap URLs, no secrets in dist)`)
