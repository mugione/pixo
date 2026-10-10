// End-to-end checks in real Chromium against `wrangler dev` (default http://127.0.0.1:8787).
// - every page × mobile/tablet/desktop × light/dark: no horizontal overflow, no hydration/console errors
// - interactions: mobile menu, language switch, theme toggle, demo tabs, contact-form validation
// Usage: npm run build && npx wrangler dev &  then  npm run test:e2e  [SCREENSHOTS=1]
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8787'
const PATHS = ['/', '/features', '/how-it-works', '/solutions', '/pricing', '/about', '/roadmap', '/faq', '/contact', '/demo', '/privacy', '/terms', '/cookies', '/kvkk', '/signup', '/does-not-exist']
const ALL = [...PATHS, ...PATHS.map((p) => (p === '/' ? '/en' : '/en' + p))]
const VIEWPORTS = [
  { name: 'mobile', width: 360, height: 780 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1366, height: 900 },
]
// The sandbox may block third-party hosts (Turnstile); those network errors are expected there.
const IGNORED = [/challenges\.cloudflare\.com/, /Failed to load resource.*(404|net::ERR)/]

const failures = []
// Client-side effects (head sync) run just after navigation commits; poll briefly instead of racing them.
const settle = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 3000 }).catch(() => {})
const check = (cond, msg) => (cond ? null : failures.push(msg))
const shots = process.env.SCREENSHOTS === '1'
if (shots) await mkdir('screenshots', { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })

for (const theme of ['light', 'dark']) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: vp, colorScheme: theme })
    const page = await ctx.newPage()
    const errors = []
    page.on('console', (m) => m.type() === 'error' && !IGNORED.some((r) => r.test(m.text())) && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    for (const path of ALL) {
      errors.length = 0
      const res = await page.goto(BASE + path, { waitUntil: 'networkidle' })
      const expected = path.includes('does-not-exist') ? 404 : 200
      check(res.status() === expected, `${path} status ${res.status()} != ${expected}`)
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        theme: document.documentElement.dataset.theme,
        h1: document.querySelectorAll('h1').length,
      }))
      check(m.sw <= m.cw, `[${theme}/${vp.name}] ${path} horizontal overflow ${m.sw} > ${m.cw}`)
      check(m.theme === theme, `[${theme}/${vp.name}] ${path} theme ${m.theme}`)
      check(m.h1 === 1, `[${theme}/${vp.name}] ${path} has ${m.h1} h1`)
      check(errors.length === 0, `[${theme}/${vp.name}] ${path} console errors: ${errors.join(' | ').slice(0, 300)}`)
      if (shots && ['/', '/en', '/pricing', '/demo', '/contact'].includes(path)) {
        await page.screenshot({ path: `screenshots/${theme}-${vp.name}${path.replace(/\//g, '_') || '_home'}.png`, fullPage: true })
      }
    }
    await ctx.close()
  }
}

// Interactions (mobile)
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, colorScheme: 'light' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })

  // mobile menu opens and navigates
  await page.getByRole('button', { name: 'Menüyü aç' }).click()
  await page.locator('#mobile-menu').getByRole('link', { name: 'Fiyatlandırma' }).click()
  await page.waitForURL(BASE + '/pricing')
  await settle(page, () => document.title.includes('Fiyatlandırma'))
  check((await page.title()).includes('Fiyatlandırma'), 'client navigation did not update <title>')
  check(!(await page.locator('#mobile-menu').isVisible()), 'mobile menu should close after navigation')

  // language switch keeps the page and updates head
  await page.getByRole('button', { name: 'Menüyü aç' }).click()
  await page.locator('#mobile-menu').getByRole('link', { name: 'en', exact: true }).click()
  await page.waitForURL(BASE + '/en/pricing')
  await settle(page, () => document.documentElement.lang === 'en')
  check((await page.locator('html').getAttribute('lang')) === 'en', 'html lang not updated to en')
  check((await page.locator('link[rel=canonical]').getAttribute('href')) === 'https://pixo.tr/en/pricing', 'canonical not updated')
  check((await page.locator('h1').textContent()).includes('Start Free'), 'EN content not shown')
  check((await page.evaluate(() => localStorage.getItem('pixo-lang'))) === 'en', 'language preference not stored')

  // theme toggle persists
  await page.getByRole('button', { name: 'Switch to dark theme' }).first().click()
  check((await page.locator('html').getAttribute('data-theme')) === 'dark', 'theme toggle failed')
  await page.reload({ waitUntil: 'networkidle' })
  check((await page.locator('html').getAttribute('data-theme')) === 'dark', 'theme not persisted')

  // demo tabs + keyboard
  await page.goto(BASE + '/demo', { waitUntil: 'networkidle' })
  await page.getByRole('tab', { name: 'Reklam Metni' }).click()
  check((await page.getByRole('tabpanel').textContent()).includes('Sade bir rutin'), 'demo tab did not switch')
  await page.keyboard.press('ArrowRight')
  check((await page.getByRole('tab', { selected: true }).textContent()) === 'Kampanya', 'demo arrow-key navigation failed')

  // contact: client-side validation, prefill from pricing "Notify me"
  await page.goto(BASE + '/pricing', { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: 'Haber Ver' }).first().click()
  await page.waitForURL(/\/contact\?subject=/)
  await page.waitForTimeout(200)
  check((await page.locator('#contact-subject').inputValue()).includes('Starter'), 'subject not prefilled')
  await page.getByRole('button', { name: 'Mesaj Gönder' }).click()
  check(await page.getByRole('alert').isVisible(), 'validation alert not shown')
  check((await page.locator('#contact-name').getAttribute('aria-invalid')) === 'true', 'name not marked invalid')
  await ctx.close()
}

await browser.close()
if (failures.length) {
  console.error(`✗ ${failures.length} e2e check(s) failed:\n` + failures.map((f) => '  - ' + f).join('\n'))
  process.exit(1)
}
console.log(`✓ e2e passed: ${ALL.length} URLs × ${VIEWPORTS.length} viewports × 2 themes + interaction checks`)
