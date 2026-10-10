// Renders PNG brand assets (OG image, touch icons) from SVG/HTML with the preinstalled Chromium.
// Run manually after changing the logo: `node scripts/generate-brand-assets.mjs`.
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const root = resolve(import.meta.dirname, '..')
const pub = join(root, 'public')
const mark = await readFile(join(pub, 'favicon.svg'), 'utf8')
const fontCss = (pkg, file) => join(root, 'node_modules', pkg, 'files', file)

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage()

async function shot(html, w, h, out) {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: join(pub, out), omitBackground: false })
  console.log('wrote', out)
}

const icon = (size) => `<html><body style="margin:0">${mark.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`
await shot(icon(180), 180, 180, 'apple-touch-icon.png')
await shot(icon(512), 512, 512, 'icon-512.png')

const jakarta = await readFile(fontCss('@fontsource-variable/plus-jakarta-sans', 'plus-jakarta-sans-latin-wght-normal.woff2')).catch(() => null)
const inter = await readFile(fontCss('@fontsource-variable/inter', 'inter-latin-wght-normal.woff2')).catch(() => null)
const ff = (name, buf) => (buf ? `@font-face{font-family:'${name}';src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2');font-weight:100 900}` : '')

await shot(
  `<html><head><style>${ff('Jakarta', jakarta)}${ff('Inter', inter)}
  body{margin:0;width:1200px;height:630px;background:#0B1020;font-family:Inter,sans-serif;color:#fff;position:relative;overflow:hidden}
  .glow{position:absolute;inset:0;background:radial-gradient(700px 380px at 75% 0%,rgba(99,91,255,.55),transparent 70%)}
  .grid{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.06) 1px,transparent 1px);background-size:48px 48px}
  .wrap{position:relative;padding:84px 88px}
  .brand{display:flex;align-items:center;gap:20px;font-family:Jakarta,sans-serif;font-weight:800;font-size:44px;letter-spacing:3px}
  .brand span{color:#A5A0FF;font-weight:600;letter-spacing:0}
  h1{font-family:Jakarta,sans-serif;font-size:76px;line-height:1.05;margin:70px 0 0;font-weight:800;letter-spacing:-1.5px;max-width:900px}
  p{font-size:28px;color:#94A3B8;margin-top:28px}
  .url{position:absolute;right:88px;bottom:64px;font-size:24px;color:#C9C6FF;font-weight:600}
  </style></head><body><div class="glow"></div><div class="grid"></div><div class="wrap">
  <div class="brand">${mark.replace('<svg ', '<svg width="64" height="64" ')} PIXO <span>AI</span></div>
  <h1>Create smarter.<br/>Market faster.</h1>
  <p>AI-powered marketing content &amp; creative studio</p></div><div class="url">pixo.tr</div></body></html>`,
  1200,
  630,
  'og-image.png',
)

await browser.close()
