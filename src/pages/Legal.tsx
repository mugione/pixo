import { useI18n } from '../i18n'
import { Notice } from '../components/ui'

type LegalKey = 'privacy' | 'terms' | 'cookies' | 'kvkk'

export function LegalPage({ doc }: { doc: LegalKey }) {
  const { t } = useI18n()
  const l = t.legal
  const d = l[doc]
  const intro = 'intro' in d ? d.intro : null
  const tbd = (s: string) => s.replace('{tbd}', t.common.toBeCompleted)
  return (
    <section className="section">
      <div className="container-page max-w-3xl">
        <span className="badge bg-warning/15 text-[#b45309] dark:text-warning">{t.common.draftBadge}</span>
        <h1 className="mt-4 text-4xl font-extrabold">{d.title}</h1>
        <p className="mt-3 text-sm text-muted">
          {t.common.lastUpdated}: {l.updated}
        </p>
        <div className="mt-8">
          <Notice tone="warning">{l.draftNotice}</Notice>
        </div>
        <article className="prose-legal mt-6">
          {intro && <p>{intro}</p>}
          {d.sections.map((s) => (
            <section key={s.h}>
              <h2>{s.h}</h2>
              {s.p?.map((p) => <p key={p}>{tbd(p)}</p>)}
              {s.ul && (
                <ul>
                  {s.ul.map((li) => (
                    <li key={li}>{tbd(li)}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      </div>
    </section>
  )
}

export const Privacy = () => <LegalPage doc="privacy" />
export const Terms = () => <LegalPage doc="terms" />
export const Cookies = () => <LegalPage doc="cookies" />
export const Kvkk = () => <LegalPage doc="kvkk" />
