// End-to-end test of the signed-in app with REAL passkeys (Chromium virtual authenticator) against
// `npm run dev:local` (http://localhost:8787 — WebAuthn needs a hostname, not an IP).
// Covers: signup → recovery codes → onboarding → brand → projects → studio states → settings
// (second passkey, recovery regen) → logout → passkey login → recovery-code login → isolation → delete.
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:8787'
const failures = []
const step = (name) => console.log('•', name)
const check = (cond, msg) => (cond ? null : failures.push(msg))

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })

async function newUserContext() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/challenges\.cloudflare|Failed to load resource/.test(m.text()) && errors.push(m.text()))
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  })
  return { ctx, page, cdp, authenticatorId, errors }
}

/** Waits for a Turnstile token only when the server has Turnstile configured. */
async function waitTurnstile(page) {
  const key = await page.evaluate(async () => (await (await fetch('/api/public-config')).json()).data.turnstileSiteKey)
  if (key) await page.waitForFunction(() => !!document.querySelector('[name="cf-turnstile-response"]')?.value, null, { timeout: 20000 })
}

async function signup(page, name) {
  await page.goto(BASE + '/signup', { waitUntil: 'load' })
  await page.fill('#su-name', name)
  await page.fill('#su-brand', 'Nova Botanics')
  await page.selectOption('#su-purpose', 'ecommerce')
  await page.check('#su-terms')
  // Turnstile (Cloudflare TEST keys locally) must hand out a token before submit.
  await waitTurnstile(page)
  await page.getByRole('button', { name: 'Hesabımı Oluştur' }).click()
  await page.getByText('Kurtarma kodlarınızı saklayın.').waitFor({ timeout: 15000 })
  const codes = await page.locator('ul[aria-label="Kurtarma kodlarınızı saklayın."] li').allTextContents()
  return codes
}

// ---------- User A ----------
const A = await newUserContext()
step('signup with passkey')
const codes = await signup(A.page, 'Ayşe Test')
check(codes.length === 10 && codes.every((c) => /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c)), `expected 10 recovery codes, got ${JSON.stringify(codes)}`)
const cookies = await A.ctx.cookies()
const session = cookies.find((c) => c.name === '__Host-pixo_session')
check(session && session.httpOnly && session.secure && session.sameSite === 'Lax', `session cookie flags wrong: ${JSON.stringify(session)}`)

step('onboarding')
await A.page.check('text=Kodları güvenli bir yere kaydettim.')
await A.page.getByRole('link', { name: 'Devam Et' }).click()
await A.page.waitForURL(BASE + '/app/welcome')
await A.page.getByRole('button', { name: 'İleri' }).click()
check((await A.page.inputValue('#w-brand')) === 'Nova Botanics', 'brand name not prefilled from signup')
await A.page.fill('#w-industry', 'Kozmetik')
await A.page.fill('#w-audience', 'Cilt bakımına ilgi duyan yetişkinler')
await A.page.getByRole('button', { name: 'İleri' }).click()
await A.page.getByRole('radio', { name: 'Samimi' }).click()
await A.page.getByRole('button', { name: 'İleri' }).click()
await A.page.getByRole('radio', { name: 'Sosyal medya gönderisi' }).click()
await A.page.getByRole('button', { name: 'İleri' }).click()
await A.page.getByRole('button', { name: 'Başla' }).click()
await A.page.waitForURL(/\/app\/create\?type=instagram_post/)

step('studio reflects AI availability honestly')
await A.page.getByText('İçerik ayarları').waitFor()
check((await A.page.inputValue('#s-contentType')) === 'instagram_post', 'content type preset not applied')
await A.page.getByText('AI hizmeti şu anda kullanılamıyor.').first().waitFor()
await A.page.waitForFunction(() => (document.querySelector('#s-brand'))?.value !== '', null, { timeout: 5000 }).catch(() => {})
const brandSelected = await A.page.locator('#s-brand option:checked').textContent()
check(brandSelected === 'Nova Botanics', `default brand not preselected (${brandSelected})`)
const aiOff = await A.page.getByText('AI hizmeti şu anda kullanılamıyor.').count()
const genDisabled = await A.page.getByRole('button', { name: 'İçerik Oluştur' }).isDisabled()
check(aiOff > 0 && genDisabled, 'without an AI binding the studio must show "unavailable" and disable generation')
// Client-side validation still works
await A.page.getByRole('tab', { name: 'Görsel' }).click()
await A.page.getByText('Ürününüz İçin Yeni Bir Görünüm Oluşturun.').waitFor()
check(await A.page.getByText('Görseller yalnızca bu cihazda saklanır.').first().isVisible(), 'local storage warning missing')

step('dashboard stats from DB')
await A.page.goto(BASE + '/app', { waitUntil: 'load' })
await A.page.getByText('Bugün Ne Oluşturmak İstersiniz?').waitFor()
check((await A.page.getByText('Henüz Bir Projeniz Yok.').count()) === 1, 'empty state expected on dashboard')

step('brand kit CRUD')
await A.page.goto(BASE + '/app/brand', { waitUntil: 'load' })
await A.page.getByRole('button', { name: 'Marka Oluştur' }).waitFor()
check((await A.page.getByRole('heading', { name: 'Nova Botanics' }).count()) === 1, 'onboarding brand missing')
await A.page.getByRole('button', { name: 'Marka Oluştur' }).click()
await A.page.fill('#b-name', 'Second Brand')
await A.page.fill('#b-slogan', 'Simple care')
await A.page.getByRole('button', { name: 'Kaydet' }).click()
await A.page.getByRole('heading', { name: 'Second Brand' }).waitFor()
await A.page.locator('li', { hasText: 'Second Brand' }).getByRole('button', { name: 'Varsayılan yap' }).click()
await A.page.waitForTimeout(400)
check((await A.page.locator('li', { hasText: 'Second Brand' }).getByText('Varsayılan').count()) >= 1, 'make default failed')

step('projects via API (create, list, search, rename, status, isolation)')
const apiA = (path, init = {}) =>
  A.page.evaluate(
    async ([p, i]) => {
      const r = await fetch(p, { ...i, headers: { 'Content-Type': 'application/json', ...(i.headers || {}) } })
      return { status: r.status, body: await r.json().catch(() => null) }
    },
    [path, init],
  )
const created = await apiA('/api/projects', { method: 'POST', body: JSON.stringify({ title: 'Kış Kampanyası', type: 'campaign', content: { campaign: { name: 'Kış', mainMessage: 'm', headlines: ['a', 'b', 'c'], socialCaptions: ['x', 'y'], shortDescription: 's', cta: 'c', visualConcept: 'v', schedule: [{ day: '1', channel: 'IG', content: 'post' }] } } }) })
check(created.status === 201, `project create ${created.status}`)
const pid = created.body?.data?.id
await A.page.goto(BASE + '/app/projects', { waitUntil: 'load' })
await A.page.getByText('Kış Kampanyası').waitFor()
await A.page.fill('input[type=search]', 'zzz')
await A.page.getByText('Aramanızla eşleşen proje bulunamadı.').waitFor()
await A.page.fill('input[type=search]', 'Kış')
await A.page.getByText('Kış Kampanyası').click()
await A.page.waitForURL(BASE + '/app/projects/' + pid)
await A.page.getByText('Kampanya ismi önerisi').waitFor()
await A.page.fill('#pd-title', 'Kış Kampanyası 2026')
await A.page.locator('#pd-title').locator('..').getByRole('button', { name: 'Kaydet' }).click()
await A.page.getByText('Proje kaydedildi.').first().waitFor()
await A.page.selectOption('#pd-status', 'completed')
await A.page.waitForTimeout(400)
const after = await apiA('/api/projects/' + pid)
check(after.body?.data?.project?.title === 'Kış Kampanyası 2026' && after.body?.data?.project?.status === 'completed', 'rename/status not persisted')

step('usage page')
await A.page.goto(BASE + '/app/usage', { waitUntil: 'load' })
await A.page.getByText('AI Kullanımınızı Takip Edin.').waitFor()
check((await A.page.getByText('0 / 3').count()) >= 1 && (await A.page.getByText('0 / 1').count()) >= 1, 'default quotas 3 text / 1 image not shown')

step('language switch in app persists to profile')
await A.page.getByRole('button', { name: 'en', exact: true }).first().click()
await A.page.getByText('Track Your AI Usage.').waitFor()
const me = await apiA('/api/auth/me')
check(me.body?.data?.user?.language === 'en', 'language not saved to profile')
await A.page.getByRole('button', { name: 'tr', exact: true }).first().click()
await A.page.getByText('AI Kullanımınızı Takip Edin.').waitFor()

step('settings: add second passkey, regenerate recovery codes')
await A.page.goto(BASE + '/app/settings', { waitUntil: 'load' })
// Same device again must be refused (excludeCredentials) …
await A.page.getByRole('button', { name: 'Geçiş Anahtarı Ekle' }).click()
await A.page.getByText(/iptal edildi|doğrulanamadı/).first().waitFor({ timeout: 10000 })
// … a second device (another virtual authenticator) is accepted.
await A.cdp.send('WebAuthn.setAutomaticPresenceSimulation', { authenticatorId: A.authenticatorId, enabled: false })
const second = await A.cdp.send('WebAuthn.addVirtualAuthenticator', {
  options: { protocol: 'ctap2', transport: 'usb', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
})
await A.page.getByRole('button', { name: 'Geçiş Anahtarı Ekle' }).click()
await A.page.getByText('Geçiş anahtarı eklendi.').first().waitFor({ timeout: 10000 })
check((await A.page.locator('li', { hasText: 'Geçiş anahtarı 2' }).count()) === 1, 'second passkey not listed')
await A.cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: second.authenticatorId })
await A.cdp.send('WebAuthn.setAutomaticPresenceSimulation', { authenticatorId: A.authenticatorId, enabled: true })
await A.page.getByRole('button', { name: 'Yeni Kodlar Oluştur' }).click()
await A.page.getByRole('dialog').getByRole('button', { name: 'Yeni Kodlar Oluştur' }).click()
await A.page.getByText('Kullanılmamış kod: 10').waitFor()
const newCodes = await A.page.locator('ul[aria-label="Kurtarma kodlarınızı saklayın."] li').allTextContents()
check(newCodes.length === 10 && !newCodes.includes(codes[0]), 'regenerated codes invalid')
codes.splice(0, codes.length, ...newCodes)

step('app pages: no horizontal overflow on mobile / tablet, light + dark')
for (const [w, h] of [[360, 780], [768, 1024]]) {
  for (const scheme of ['light', 'dark']) {
    await A.page.setViewportSize({ width: w, height: h })
    await A.page.emulateMedia({ colorScheme: scheme })
    for (const path of ['/app', '/app/create', '/app/create?tab=image', '/app/campaigns', '/app/projects', '/app/projects/' + pid, '/app/brand', '/app/history', '/app/usage', '/app/settings']) {
      await A.page.goto(BASE + path, { waitUntil: 'load' })
      await A.page.waitForTimeout(250)
      const m = await A.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
      check(m.sw <= m.cw, `[${scheme} ${w}px] ${path} overflows (${m.sw} > ${m.cw})`)
      if (process.env.SCREENSHOTS === '1' && w === 360 && ['/app', '/app/create'].includes(path)) {
        await A.page.screenshot({ path: `screenshots/app-${scheme}-mobile${path.replace(/\//g, '_')}.png`, fullPage: true })
      }
    }
  }
}
await A.page.setViewportSize({ width: 1280, height: 900 })
await A.page.emulateMedia({ colorScheme: 'light' })
if (process.env.SCREENSHOTS === '1') {
  for (const path of ['/app', '/app/create', '/app/create?tab=image', '/app/campaigns', '/app/projects/' + pid, '/app/settings']) {
    await A.page.goto(BASE + path, { waitUntil: 'load' })
    await A.page.waitForTimeout(400)
    await A.page.screenshot({ path: `screenshots/app-desktop${path.replace(/[/?=]/g, '_')}.png`, fullPage: true })
  }
}

step('logout → /app redirects to login → passkey login')
await A.page.locator('aside').getByRole('button', { name: 'Çıkış Yap' }).click()
await A.page.waitForURL(BASE + '/')
const res = await A.page.goto(BASE + '/app/projects')
check(A.page.url().startsWith(BASE + '/login?next='), `expected redirect to login, got ${A.page.url()} (${res.status()})`)
await A.page.getByRole('button', { name: 'Geçiş Anahtarıyla Giriş Yap' }).click()
await A.page.waitForURL(BASE + '/app/projects')
await A.page.getByText('Kış Kampanyası 2026').waitFor()

step('recovery-code login (single use)')
await apiA('/api/auth/logout', { method: 'POST', body: '{}' })
await A.page.goto(BASE + '/login', { waitUntil: 'load' })
await A.page.getByRole('button', { name: 'Kurtarma kodu ile giriş yap' }).click()
await A.page.fill('#rc-code', codes[0].toLowerCase())
await waitTurnstile(A.page)
await A.page.getByRole('button', { name: 'Kodla Giriş Yap' }).click()
await A.page.getByText(/Kalan kurtarma kodu: 9/).waitFor()
await A.page.waitForURL(BASE + '/app/settings')
const reuse = await apiA('/api/auth/recovery', { method: 'POST', body: JSON.stringify({ code: codes[0] }) })
check(reuse.status === 400, `used recovery code must not work twice (${reuse.status})`)

// ---------- User B: isolation ----------
step('second user cannot see or change user A data')
const B = await newUserContext()
await signup(B.page, 'Bora Test')
const apiB = (path, init = {}) =>
  B.page.evaluate(
    async ([p, i]) => {
      const r = await fetch(p, { ...i, headers: { 'Content-Type': 'application/json', ...(i.headers || {}) } })
      return { status: r.status, body: await r.json().catch(() => null) }
    },
    [path, init],
  )
check((await apiB('/api/projects/' + pid)).status === 404, 'B can read A project')
check((await apiB('/api/projects/' + pid, { method: 'PUT', body: JSON.stringify({ title: 'hacked' }) })).status === 404, 'B can update A project')
check((await apiB('/api/projects/' + pid, { method: 'DELETE' })).status === 404, 'B can delete A project')
check(((await apiB('/api/projects')).body?.data?.projects ?? []).length === 0, 'B sees A projects in list')
check(((await apiB('/api/brands')).body?.data?.brands ?? []).length === 0, 'B sees A brands')
const bAdmin = await apiB('/api/user/profile', { method: 'PUT', body: JSON.stringify({ role: 'admin' }) })
check((await apiB('/api/auth/me')).body?.data?.user?.role === 'user', `role escalation via profile (${bAdmin.status})`)
const csrf = await apiB('/api/projects', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: JSON.stringify({ title: 'x', type: 'text' }) })
// Browsers forbid overriding Origin from fetch(), so this mainly documents intent; the server test covers it.
check([201, 403].includes(csrf.status), `unexpected status ${csrf.status}`)

step('AI endpoints are protected and fail honestly without a binding')
const noKey = await apiB('/api/ai/generate-text', { method: 'POST', body: JSON.stringify({}) })
check(noKey.status === 503 || noKey.status === 400, `generate-text without AI binding: ${noKey.status}`)
const anon = await browser.newContext()
const anonPage = await anon.newPage()
await anonPage.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
const anonRes = await anonPage.evaluate(async () => (await fetch('/api/ai/generate-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status)
check(anonRes === 401 || anonRes === 503, `anonymous AI call must be rejected (${anonRes})`)
await anon.close()

step('onboarding gate, then delete account')
await B.page.goto(BASE + '/app/settings', { waitUntil: 'load' })
await B.page.waitForURL(BASE + '/app/welcome') // not onboarded yet → wizard first
await B.page.getByRole('button', { name: 'Atla' }).click()
await B.page.waitForURL(BASE + '/app')
await B.page.goto(BASE + '/app/settings', { waitUntil: 'load' })
await B.page.fill('#st-delete', 'DELETE')
await B.page.getByRole('button', { name: 'Hesabımı Kalıcı Olarak Sil' }).click()
await B.page.waitForURL(BASE + '/')
check((await apiB('/api/auth/me')).status === 401, 'session still valid after account deletion')

check(A.errors.length === 0, `console errors (A): ${A.errors.join(' | ').slice(0, 400)}`)
check(B.errors.length === 0, `console errors (B): ${B.errors.join(' | ').slice(0, 400)}`)

await browser.close()
if (failures.length) {
  console.error(`✗ ${failures.length} app e2e check(s) failed:\n` + failures.map((f) => '  - ' + f).join('\n'))
  process.exit(1)
}
console.log('✓ app e2e passed (passkey signup/login, recovery codes, onboarding, brands, projects, usage, settings, isolation, deletion)')
