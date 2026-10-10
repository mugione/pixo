import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Alert, Field, TextInput } from '../app/ui'
import { fill, useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { LogoMark } from '../components/Logo'
import { ApiError, post } from '../lib/api'
import { isCancelled, loginWithPasskey, passkeysSupported } from '../lib/passkey'
import { useTurnstile } from '../lib/useTurnstile'

/** Only same-site app paths are allowed as post-login targets (no open redirects). */
function nextTarget(): string {
  const n = new URLSearchParams(window.location.search).get('next') ?? ''
  return /^\/app(\/[\w\-/?=&%.]*)?$/.test(n) ? n : '/app'
}

export default function Login() {
  const { t, lang, to } = useI18n()
  const a = t.app.auth
  const [supported, setSupported] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recovery, setRecovery] = useState(false)
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const ts = useTurnstile('recovery', lang)

  useEffect(() => setSupported(passkeysSupported()), [])

  const login = async () => {
    setBusy(true)
    setError(null)
    try {
      await loginWithPasskey()
      window.location.assign(nextTarget())
    } catch (e) {
      setError(
        isCancelled(e)
          ? a.cancelled
          : e instanceof ApiError && e.message === 'Unknown passkey'
            ? a.unknownPasskey
            : e instanceof ApiError && e.code === 'rate_limited'
              ? t.errors.rateLimited.body
              : e instanceof ApiError && e.code === 'network_error'
                ? t.errors.network.body
                : a.failed,
      )
      setBusy(false)
    }
  }

  const useCode = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await post<{ remainingCodes: number }>('/api/auth/recovery', { code, turnstileToken: ts.token })
      setNotice(fill(a.recoveryLeft, { n: String(r.remainingCodes) }))
      setTimeout(() => window.location.assign('/app/settings'), 1800)
    } catch (err) {
      ts.reset()
      setError(err instanceof ApiError && err.code === 'rate_limited' ? t.errors.rateLimited.body : err instanceof ApiError && err.code === 'captcha_failed' ? t.errors.captcha.body : a.recoveryInvalid)
      setBusy(false)
    }
  }

  return (
    <section className="section">
      <div className="container-page max-w-md">
        <div className="card p-6 text-center sm:p-10">
          <LogoMark size={44} className="mx-auto" />
          <h1 className="mt-6 text-2xl font-extrabold sm:text-3xl">{a.loginTitle}</h1>
          <p className="mt-3 text-muted">{a.loginLead}</p>
          {supported === false && !recovery && (
            <div className="mt-6 text-left">
              <Alert tone="warning" title={a.unsupportedTitle} body={a.unsupportedBody} />
            </div>
          )}
          {!recovery ? (
            <button type="button" className="btn-primary btn-lg mt-8 w-full" onClick={login} disabled={busy || !supported}>
              <Icon name="key" className="h-4 w-4" />
              {busy ? a.loggingIn : a.loginButton}
            </button>
          ) : (
            <form noValidate onSubmit={useCode} className="mt-8 space-y-4 text-left">
              <Field id="rc-code" label={a.recoveryLabel}>
                <TextInput id="rc-code" autoComplete="one-time-code" placeholder={a.recoveryPh} maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
              </Field>
              <div ref={ts.ref} />
              <button type="submit" className="btn-primary w-full" disabled={busy || code.replace(/[^a-z0-9]/gi, '').length !== 12 || (ts.required && !ts.token)}>
                {a.recoverySubmit}
              </button>
            </form>
          )}
          {error && (
            <div className="mt-4 text-left">
              <Alert title={error} />
            </div>
          )}
          {notice && (
            <div className="mt-4 text-left">
              <Alert tone="success" title={notice} />
            </div>
          )}
          <button
            type="button"
            className="mt-4 text-sm font-semibold text-brand-fg hover:underline"
            onClick={() => {
              setRecovery((r) => !r)
              setError(null)
            }}
          >
            {recovery ? a.loginButton : a.useRecovery}
          </button>
          <p className="mt-6 text-sm text-muted">
            {a.noAccount}{' '}
            <Link to={to('signup')} className="font-semibold text-brand-fg hover:underline">
              {a.signupLink}
            </Link>
          </p>
        </div>
      </div>
    </section>
  )
}
