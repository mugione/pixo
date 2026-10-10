import { Link } from 'react-router'
import { useI18n } from '../i18n'
import { Icon, type IconName } from '../components/Icon'
import { ProductPreview } from '../components/ProductPreview'
import { CtaBand, IconTile, SectionHeading } from '../components/ui'

const VALUE_ICONS: IconName[] = ['sparkles', 'image', 'megaphone', 'palette', 'layout', 'globe']
const SOLUTION_ICONS: IconName[] = ['bag', 'share', 'target', 'shield']

export default function Home() {
  const { t, to } = useI18n()
  const h = t.home
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full opacity-40 blur-3xl dark:opacity-25"
          style={{ background: 'radial-gradient(closest-side, #635BFF, transparent)' }}
          aria-hidden="true"
        />
        <div className="container-page relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <span className="eyebrow">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
              {h.hero.eyebrow}
            </span>
            <h1 className="mt-6 text-4xl leading-[1.08] font-extrabold sm:text-5xl lg:text-[3.6rem]">{h.hero.title}</h1>
            <p className="mt-6 max-w-xl text-lg text-muted">{h.hero.subtitle}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={to('signup')} className="btn-primary btn-lg">
                {h.hero.primary}
                <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
              <a href="#how-it-works" className="btn-secondary btn-lg">
                {h.hero.secondary}
              </a>
            </div>
            <p className="mt-5 flex items-start gap-2 text-sm text-muted">
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
              {h.hero.note}
            </p>
          </div>
          <div className="lg:pl-4">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* Value */}
      <section className="section border-t border-line bg-bg-subtle" id="features">
        <div className="container-page">
          <SectionHeading title={h.value.title} lead={h.value.lead} />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {h.value.cards.map((c, i) => (
              <li key={c.title} className="card p-6 transition-shadow hover:shadow-[var(--shadow-lift)]">
                <IconTile name={VALUE_ICONS[i]} />
                <h3 className="mt-5 text-lg font-bold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="section scroll-mt-16" id="how-it-works">
        <div className="container-page">
          <SectionHeading title={h.how.title} center />
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {h.how.steps.map((s, i) => (
              <li key={s.title} className="card relative p-6">
                <span className="font-mono text-sm font-semibold text-brand-fg">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 text-center">
            <Link to={to('signup')} className="btn-primary btn-lg">
              {h.how.cta}
            </Link>
          </div>
        </div>
      </section>

      {/* AI Studio */}
      <section className="section border-y border-line bg-bg-subtle">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading title={h.studio.title} lead={h.studio.lead} />
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {h.studio.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-sm font-medium">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-success">
                    <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <Link to={to('features')} className="btn-secondary mt-8">
              {h.studio.cta}
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
          <StudioIllustration />
        </div>
      </section>

      {/* Solutions */}
      <section className="section">
        <div className="container-page">
          <SectionHeading title={h.solutions.title} />
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {h.solutions.items.map((s, i) => (
              <li key={s.title} className="card p-6">
                <IconTile name={SOLUTION_ICONS[i]} />
                <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Benefits */}
      <section className="section border-y border-line bg-bg-subtle">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <SectionHeading title={h.benefits.title} lead={h.benefits.lead} />
          <ul className="grid gap-3 sm:grid-cols-2">
            {h.benefits.items.map((b) => (
              <li key={b} className="card flex items-center gap-3 p-4 text-sm font-medium">
                <Icon name="check" className="h-5 w-5 shrink-0 text-brand-fg" strokeWidth={2.2} />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="section">
        <div className="container-page">
          <div className="card flex flex-col items-start gap-6 p-8 sm:p-10 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold sm:text-3xl">{h.pricing.title}</h2>
              <p className="mt-3 text-muted">{h.pricing.lead}</p>
            </div>
            <Link to={to('pricing')} className="btn-secondary btn-lg shrink-0">
              {h.pricing.cta}
            </Link>
          </div>
        </div>
      </section>

      <CtaBand title={h.final.title} lead={h.final.lead} cta={h.final.cta} to={to('signup')} />
    </>
  )
}

/** Decorative composition of tone/variant chips — purely visual, no interactive controls. */
function StudioIllustration() {
  const { t } = useI18n()
  const tabs = t.demo.tabs
  return (
    <div className="card relative overflow-hidden p-5 sm:p-6" aria-hidden="true">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab, i) => (
          <span
            key={tab.label}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${i === 0 ? 'bg-brand text-white' : 'bg-surface-2 text-muted'}`}
          >
            {tab.label}
          </span>
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {tabs.map((tab, i) => (
          <div key={tab.label} className={`rounded-xl border p-4 ${i === 0 ? 'border-brand/30 bg-brand-soft/40' : 'border-line bg-bg'}`}>
            <p className="font-display text-sm font-bold">{tab.heading}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted">{tab.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted">
        <span>Nova Botanics</span>
        <span className="badge bg-warning/15 text-[#b45309] dark:text-warning">{t.common.demoBadge}</span>
      </div>
    </div>
  )
}
