import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { PURPOSES } from '../../shared/auth'
import { Alert, Field, Select, TextInput } from '../app/ui'
import { RecoveryCodes } from '../app/pages/Settings'
import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { LogoMark } from '../components/Logo'
import { ApiError } from '../lib/api'
import { isCancelled, passkeysSupported, registerPasskey } from '../lib/passkey'
import { STORAGE_KEYS } from '../lib/site'
import { useTurnstile } from '../lib/useTurnstile'

export default function Signup() {
  const { t, lang, to } = useI18n()
  const a = t.app.auth
  const [supported, setSupported] = useState<boolean | null>(null)
  const [form, setForm] = useState({ displayName: '', brandName: '', email: '', purpose: '', acceptTerms: false })
  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ title: string; body?: string } | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [savedCodes, setSavedCodes] = useState(false)
  const ts = useTurnstile('register', lang)

  useEffect(() => setSupported(passkeysSupported()), [])

  const set = (k: keyof typeof form, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }))
    setFieldErrors((e) => e.filter((x) => x !== k))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const errs: string[] = []
    if (form.displayName.trim().length < 2) errs.push('displayName')
    if (!form.purpose) errs.push('purpose')
    if (!form.acceptTerms) errs.push('acceptTerms')
    setFieldErrors(errs)
    if (errs.length) return
    if (ts.required && !ts.token) return setError(ts.state === 'failed' ? t.errors.unavailable : t.errors.captcha)
    setBusy(true)
    try {
      const r = await registerPasskey<{ recoveryCodes: string[] }>('/api/auth/register/options', '/api/auth/register/verify', {
        ...form,
        language: lang,
        turnstileToken: ts.token,
      })
      try {
        localStorage.setItem(STORAGE_KEYS.lang, lang)
      } catch {
        /* ignore */
      }
      setCodes(r.recoveryCodes)
    } catch (err) {
      ts.reset()
      if (isCancelled(err)) setError({ title: a.cancelled })
      else if (err instanceof ApiError) {
        if (err.code === 'validation_error') setFieldErrors(err.fields)
        setError(
          err.code === 'registrations_closed'
            ? { title: a.closed }
            : err.code === 'conflict'
              ? { title: a.duplicate }
              : err.code === 'rate_limited'
                ? t.errors.rateLimited
                : err.code === 'captcha_failed'
                  ? t.errors.captcha
                  : err.code === 'validation_error'
                    ? t.errors.validation
                    : err.code === 'network_error'
                      ? t.errors.network
                      : { title: a.failed },
        )
      } else setError({ title: a.failed })
    } finally {
      setBusy(false)
    }
  }

  const [before, rest] = a.acceptTerms.split('{terms}')
  const [middle, after] = rest.split('{privacy}')

  return (
    <section className="section">
      <div className="container-page max-w-xl">
        <div className="card p-6 sm:p-10">
          <LogoMark size={44} />
          {codes ? (
            <>
              <h1 className="mt-6 text-2xl font-extrabold sm:text-3xl">{a.codesTitle}</h1>
              <p className="mt-3 text-muted">{a.codesLead}</p>
              <div className="mt-6">
                <RecoveryCodes codes={codes} />
              </div>
              <label className="mt-6 flex items-center gap-2.5 text-sm font-medium">
                <input type="checkbox" checked={savedCodes} onChange={(e) => setSavedCodes(e.target.checked)} className="h-4 w-4 accent-brand" />
                {a.savedCodes}
              </label>
              <p className="mt-4 text-xs text-muted">{a.secondKeyTip}</p>
              <a href="/app/welcome" className={`btn-primary btn-lg mt-6 w-full ${savedCodes ? '' : 'pointer-events-none opacity-50'}`} aria-disabled={!savedCodes}>
                {a.continue}
              </a>
            </>
          ) : (
            <>
              <h1 className="mt-6 text-2xl font-extrabold sm:text-3xl">{a.signupTitle}</h1>
              <p className="mt-3 text-muted">{a.signupLead}</p>
              {supported === false ? (
                <div className="mt-8">
                  <Alert tone="warning" title={a.unsupportedTitle} body={a.unsupportedBody} />
                </div>
              ) : (
                <form noValidate onSubmit={submit} className="mt-8 space-y-4">
                  <Field id="su-name" label={a.name} error={fieldErrors.includes('displayName') ? t.contact.fieldErrors.name : undefined}>
                    <TextInput id="su-name" autoComplete="name" maxLength={100} value={form.displayName} error={fieldErrors.includes('displayName') ? 'x' : undefined} onChange={(e) => set('displayName', e.target.value)} />
                  </Field>
                  <Field id="su-brand" label={a.brand} optional>
                    <TextInput id="su-brand" autoComplete="organization" maxLength={100} value={form.brandName} onChange={(e) => set('brandName', e.target.value)} />
                  </Field>
                  <Field id="su-email" label={a.email} optional hint={a.emailHint} error={fieldErrors.includes('email') ? t.contact.fieldErrors.email : undefined}>
                    <TextInput id="su-email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={(e) => set('email', e.target.value)} />
                  </Field>
                  <Field id="su-purpose" label={a.purpose} error={fieldErrors.includes('purpose') ? a.choose : undefined}>
                    <Select id="su-purpose" options={PURPOSES} labels={t.app.options.purposes} placeholder={a.choose} value={form.purpose} error={fieldErrors.includes('purpose') ? 'x' : undefined} onChange={(e) => set('purpose', e.target.value)} />
                  </Field>
                  <label className="flex items-start gap-2.5 text-sm text-muted">
                    <input
                      id="su-terms"
                      type="checkbox"
                      checked={form.acceptTerms}
                      aria-invalid={fieldErrors.includes('acceptTerms') || undefined}
                      onChange={(e) => set('acceptTerms', e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                    />
                    <span>
                      {before}
                      <Link to={to('terms')} target="_blank" className="font-semibold text-brand-fg hover:underline">
                        {a.termsLink}
                      </Link>
                      {middle}
                      <Link to={to('privacy')} target="_blank" className="font-semibold text-brand-fg hover:underline">
                        {a.privacyLink}
                      </Link>
                      {after}
                    </span>
                  </label>
                  {fieldErrors.includes('acceptTerms') && <p className="text-xs font-medium text-danger">{t.contact.fieldErrors.consent}</p>}
                  <div ref={ts.ref} />
                  <p className="flex gap-2 rounded-xl bg-brand-soft/60 px-3 py-2.5 text-xs text-fg">
                    <Icon name="key" className="mt-0.5 h-4 w-4 shrink-0 text-brand-fg" />
                    {a.passkeyInfo}
                  </p>
                  {error && <Alert title={error.title} body={error.body} />}
                  <button type="submit" className="btn-primary btn-lg w-full" disabled={busy || supported === null}>
                    {busy ? a.creating : a.create}
                  </button>
                </form>
              )}
              <p className="mt-6 text-center text-sm text-muted">
                {a.haveAccount}{' '}
                <Link to={to('login')} className="font-semibold text-brand-fg hover:underline">
                  {a.loginLink}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
