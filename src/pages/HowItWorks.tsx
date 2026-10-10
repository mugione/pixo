import { Link } from 'react-router'
import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { PageHero } from '../components/ui'

export default function HowItWorks() {
  const { t, to } = useI18n()
  const h = t.howItWorks
  return (
    <>
      <PageHero title={h.title} lead={h.lead} />
      <section className="section">
        <div className="container-page">
          <ol className="relative mx-auto max-w-3xl space-y-4">
            {h.steps.map((s, i) => (
              <li key={s} className="card flex items-center gap-5 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white font-mono">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-base font-medium">{s}</span>
              </li>
            ))}
          </ol>
          <div className="card mx-auto mt-12 flex max-w-3xl flex-col items-start gap-5 bg-brand-soft/40 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">{h.demoTitle}</h2>
              <p className="mt-2 text-sm text-muted">{h.demoBody}</p>
            </div>
            <Link to={to('demo')} className="btn-primary shrink-0">
              {h.demoCta}
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
