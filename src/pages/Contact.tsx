import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { validateContact, type ContactField } from '../../shared/contact'
import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { PageHero } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { loadTurnstile } from '../lib/turnstile'

type Status = 'idle' | 'sending' | 'sent'
type ErrorKey = 'generic' | 'network' | 'rateLimited' | 'captcha' | 'validation' | 'unavailable'

const ERROR_MAP: Partial<Record<string, ErrorKey>> = {
  network_error: 'network',
  rate_limited: 'rateLimited',
  captcha_failed: 'captcha',
  validation_error: 'validation',
  unavailable: 'unavailable',
}

export default function Contact() {
  const { t, lang, to } = useI18n()
  const c = t.contact
  const [params] = useSearchParams()
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', consent: false })
  const [fieldErrors, setFieldErrors] = useState<ContactField[]>([])
  const [error, setError] = useState<ErrorKey | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [token, setToken] = useState('')
  const [captchaState, setCaptchaState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const widgetEl = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  // Prefill the subject from ?subject= (e.g. "Notify me" buttons on the pricing page).
  useEffect(() => {
    const s = params.get('subject')
    if (s) setForm((f) => (f.subject ? f : { ...f, subject: s.slice(0, 150) }))
  }, [params])

  // Turnstile: the public site key comes from the Worker so it can change without a rebuild.
  useEffect(() => {
    if (status === 'sent') return
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await api<{ turnstileSiteKey: string | null }>('/api/public-config')
        if (!cfg.turnstileSiteKey) throw new Error('no site key')
        const ts = await loadTurnstile()
        if (cancelled || !widgetEl.current) return
        widgetId.current = ts.render(widgetEl.current, {
          sitekey: cfg.turnstileSiteKey,
          language: lang,
          theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
          action: 'contact',
          callback: (tok: string) => setToken(tok),
          'expired-callback': () => setToken(''),
          'error-callback': () => setToken(''),
        })
        setCaptchaState('ready')
      } catch {
        if (!cancelled) setCaptchaState('failed')
      }
    })()
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [lang, status])

  const update = (k: keyof typeof form) => (e: { target: { value: string; checked?: boolean } }) => {
    const v = k === 'consent' ? !!e.target.checked : e.target.value
    setForm((f) => ({ ...f, [k]: v }))
    setFieldErrors((fe) => fe.filter((x) => x !== k))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const payload = { ...form, turnstileToken: token, lang }
    const v = validateContact(payload)
    if (!v.ok) {
      setFieldErrors(v.fields)
      setError('validation')
      document.getElementById(`contact-${v.fields[0]}`)?.focus()
      return
    }
    if (!token) {
      setError(captchaState === 'failed' ? 'unavailable' : 'captcha')
      return
    }
    setStatus('sending')
    try {
      await api<{ id: string }>('/api/contact', { method: 'POST', body: JSON.stringify(payload) })
      setStatus('sent')
      setForm({ name: '', email: '', subject: '', message: '', consent: false })
      setToken('')
    } catch (err) {
      setStatus('idle')
      if (err instanceof ApiError && err.code === 'validation_error') setFieldErrors(err.fields as ContactField[])
      setError((err instanceof ApiError && ERROR_MAP[err.code]) || 'generic')
      setToken('')
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current)
    }
  }

  const invalid = (k: ContactField) => fieldErrors.includes(k)
  const fieldProps = (k: Exclude<ContactField, 'consent'>) => ({
    id: `contact-${k}`,
    name: k,
    value: form[k],
    onChange: update(k),
    'aria-invalid': invalid(k) || undefined,
    'aria-describedby': invalid(k) ? `contact-${k}-error` : undefined,
    className: `input ${invalid(k) ? '!border-danger' : ''}`,
  })
  const fieldError = (k: ContactField) =>
    invalid(k) ? (
      <p id={`contact-${k}-error`} className="mt-1.5 text-xs font-medium text-danger">
        {c.fieldErrors[k]}
      </p>
    ) : null

  const [before, after] = c.consent.split('{kvkk}')

  return (
    <>
      <PageHero title={c.title} lead={c.lead} />
      <section className="section">
        <div className="container-page grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div className="card p-6 sm:p-8">
            {status === 'sent' ? (
              <div role="status" className="py-8 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
                  <Icon name="check" className="h-7 w-7" strokeWidth={2.4} />
                </span>
                <p className="mt-5 text-lg font-semibold">{c.success}</p>
                <button type="button" className="btn-secondary mt-6" onClick={() => setStatus('idle')}>
                  {c.sendAnother}
                </button>
              </div>
            ) : (
              <form noValidate onSubmit={onSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="contact-name" className="label">{c.name}</label>
                    <input {...fieldProps('name')} type="text" autoComplete="name" maxLength={100} placeholder={c.namePh} required />
                    {fieldError('name')}
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="label">{c.email}</label>
                    <input {...fieldProps('email')} type="email" autoComplete="email" maxLength={254} placeholder={c.emailPh} required />
                    {fieldError('email')}
                  </div>
                </div>
                <div>
                  <label htmlFor="contact-subject" className="label">{c.subject}</label>
                  <input {...fieldProps('subject')} type="text" maxLength={150} placeholder={c.subjectPh} required />
                  {fieldError('subject')}
                </div>
                <div>
                  <label htmlFor="contact-message" className="label">{c.message}</label>
                  <textarea {...fieldProps('message')} rows={6} maxLength={5000} placeholder={c.messagePh} required />
                  {fieldError('message')}
                </div>
                <div>
                  <label className="flex items-start gap-3 text-sm text-muted">
                    <input
                      id="contact-consent"
                      type="checkbox"
                      checked={form.consent}
                      onChange={update('consent')}
                      aria-invalid={invalid('consent') || undefined}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-brand"
                    />
                    <span>
                      {before}
                      <Link to={to('kvkk')} className="font-semibold text-brand-fg underline-offset-2 hover:underline" target="_blank">
                        {c.consentLink}
                      </Link>
                      {after}
                    </span>
                  </label>
                  {fieldError('consent')}
                </div>
                <div className="min-h-[65px]">
                  <div ref={widgetEl} />
                  {captchaState === 'loading' && <p className="text-xs text-muted">{c.loadingCaptcha}</p>}
                  {captchaState === 'failed' && (
                    <p className="text-xs font-medium text-danger">
                      {t.errors.unavailable.title} {t.errors.unavailable.body}
                    </p>
                  )}
                </div>
                {error && (
                  <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm">
                    <p className="font-semibold text-danger">{t.errors[error].title}</p>
                    <p className="mt-0.5 text-fg">{t.errors[error].body}</p>
                  </div>
                )}
                <button type="submit" className="btn-primary btn-lg w-full sm:w-auto" disabled={status === 'sending'}>
                  {status === 'sending' ? c.sending : c.submit}
                </button>
              </form>
            )}
          </div>
          <aside className="space-y-5">
            <div className="card p-6">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand-fg">
                <Icon name="clock" />
              </span>
              <h2 className="mt-4 text-base font-bold">{c.sideTitle}</h2>
              <p className="mt-2 text-sm text-muted">{c.sideBody}</p>
            </div>
            <p className="flex items-center gap-2 px-1 text-xs text-muted">
              <Icon name="shield" className="h-4 w-4" />
              {c.privacyNote}
            </p>
          </aside>
        </div>
      </section>
    </>
  )
}
