import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Icon } from './Icon'

export function PageHero({ eyebrow, title, lead, children }: { eyebrow?: ReactNode; title: string; lead?: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="container-page relative py-16 sm:py-20">
        <div className="max-w-3xl">
          {eyebrow && <div className="mb-5">{eyebrow}</div>}
          <h1 className="text-4xl font-extrabold sm:text-5xl">{title}</h1>
          {lead && <p className="mt-5 text-lg text-muted">{lead}</p>}
          {children}
        </div>
      </div>
    </section>
  )
}

export function SectionHeading({ title, lead, center = false }: { title: string; lead?: string; center?: boolean }) {
  return (
    <div className={`max-w-2xl ${center ? 'mx-auto text-center' : ''}`}>
      <h2 className="section-title">{title}</h2>
      {lead && <p className="section-lead">{lead}</p>}
    </div>
  )
}

export function IconTile({ name }: { name: Parameters<typeof Icon>[0]['name'] }) {
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand-fg">
      <Icon name={name} className="h-5 w-5" />
    </span>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning'; children: ReactNode }) {
  const cls =
    tone === 'warning'
      ? 'border-warning/40 bg-warning/10 text-fg'
      : 'border-brand/30 bg-brand-soft text-fg'
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${cls}`}>
      <Icon name="info" className={`mt-0.5 h-4 w-4 shrink-0 ${tone === 'warning' ? 'text-warning' : 'text-brand-fg'}`} />
      <div>{children}</div>
    </div>
  )
}

export function DemoBadge({ label }: { label: string }) {
  return <span className="badge bg-warning/15 text-[#b45309] dark:text-warning">{label}</span>
}

export function CtaBand({ title, lead, cta, to }: { title: string; lead: string; cta: string; to: string }) {
  return (
    <section className="section">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-3xl bg-[#0B1020] px-6 py-14 text-center sm:px-12 sm:py-20">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{ background: 'radial-gradient(600px 260px at 50% 0%, rgb(99 91 255 / 0.45), transparent 70%)' }}
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold !text-white sm:text-4xl">{title}</h2>
            <p className="mt-4 text-base text-slate-300 sm:text-lg">{lead}</p>
            <Link to={to} className="btn-primary btn-lg mt-8">
              {cta}
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
