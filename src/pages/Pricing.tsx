import { Link } from 'react-router'
import { fill, useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { PageHero } from '../components/ui'

export default function Pricing() {
  const { t, to } = useI18n()
  const p = t.pricing
  return (
    <>
      <PageHero title={p.title} lead={p.lead} />
      <section className="section">
        <div className="container-page grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          <article className="card relative overflow-hidden border-brand/40 p-8 shadow-[var(--shadow-lift)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand to-brand-dark" aria-hidden="true" />
            <h2 className="text-xl font-bold">{p.free.name}</h2>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="font-display text-5xl font-extrabold">{p.free.price}</span>
              <span className="text-sm text-muted">/ {p.free.period}</span>
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {p.free.features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm">
                  <Icon name="check" className="h-4 w-4 shrink-0 text-success" strokeWidth={2.4} />
                  {f}
                </li>
              ))}
            </ul>
            <Link to={to('signup')} className="btn-primary btn-lg mt-8 w-full sm:w-auto">
              {p.free.cta}
            </Link>
            <p className="mt-5 text-xs text-muted">{p.free.note}</p>
          </article>

          <div>
            <h2 className="text-xl font-bold">{p.plannedTitle}</h2>
            <p className="mt-2 text-sm text-muted">{p.plannedLead}</p>
            <ul className="mt-6 space-y-4">
              {p.planned.map((plan) => (
                <li key={plan.name} className="card p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <span className="badge bg-surface-2 text-muted">{p.developing}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{plan.body}</p>
                  <Link
                    to={`${to('contact')}?subject=${encodeURIComponent(fill(t.contact.notifySubject, { plan: plan.name }))}`}
                    className="btn-secondary mt-4 !px-4 !py-2"
                  >
                    <Icon name="mail" className="h-4 w-4" />
                    {p.notify}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}
