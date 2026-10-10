import { Link } from 'react-router'
import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { LogoMark } from '../components/Logo'
import { Notice } from '../components/ui'

/**
 * Phase 1: accounts are not available yet, so this page says so plainly instead of showing a
 * non-working form. Phase 2 replaces it with passkey (WebAuthn) registration and sign-in.
 */
export default function Signup() {
  const { t, to } = useI18n()
  const s = t.signup
  return (
    <section className="section">
      <div className="container-page max-w-xl">
        <div className="card p-8 text-center sm:p-10">
          <LogoMark size={48} className="mx-auto" />
          <h1 className="mt-6 text-3xl font-extrabold">{s.title}</h1>
          <p className="mt-3 text-muted">{s.lead}</p>
          <div className="mt-8 text-left">
            <Notice>
              <p className="font-semibold">{s.notice}</p>
              <p className="mt-1 text-muted">{s.noticeBody}</p>
            </Notice>
          </div>
          <div className="mt-6 rounded-xl border border-line bg-bg-subtle p-5 text-left">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Icon name="key" className="h-4 w-4 text-brand-fg" />
              {s.passkeyTitle}
            </h2>
            <p className="mt-2 text-sm text-muted">{s.passkeyBody}</p>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to={to('demo')} className="btn-primary">
              {s.demoCta}
            </Link>
            <Link to={to('contact')} className="btn-secondary">
              {s.contactCta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
