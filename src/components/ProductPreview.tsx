import { useId } from 'react'
import { useI18n } from '../i18n'
import { DemoBadge } from './ui'
import { Icon } from './Icon'

/** Illustrative product bottle used in demo previews (pure SVG, no external image). */
export function ProductVisual({ className = '' }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  const bg = `pv-bg-${uid}`
  const bottle = `pv-bottle-${uid}`
  return (
    <svg viewBox="0 0 240 200" className={className} role="img" aria-label="Botanical Face Cleanser">
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E8F5EE" />
          <stop offset="1" stopColor="#D7ECF4" />
        </linearGradient>
        <linearGradient id={bottle} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E9EEF3" />
        </linearGradient>
      </defs>
      <rect width="240" height="200" fill={`url(#${bg})`} />
      <ellipse cx="120" cy="176" rx="70" ry="9" fill="#0B1020" opacity="0.08" />
      <path d="M58 150c-14-26 2-62 30-70-6 22-14 46-30 70z" fill="#7CC4A0" opacity="0.8" />
      <path d="M186 152c12-30-6-58-28-62 6 20 12 42 28 62z" fill="#5FB08A" opacity="0.7" />
      <rect x="104" y="34" width="32" height="18" rx="4" fill="#3F7E66" />
      <rect x="92" y="50" width="56" height="124" rx="16" fill={`url(#${bottle})`} stroke="#D5DEE6" />
      <rect x="102" y="92" width="36" height="44" rx="6" fill="#F4FAF7" stroke="#CFE5DA" />
      <text x="120" y="110" textAnchor="middle" fontSize="7" fontWeight="700" fill="#2F5E4C" fontFamily="sans-serif">NOVA</text>
      <text x="120" y="121" textAnchor="middle" fontSize="5" fill="#4D7A68" fontFamily="sans-serif">BOTANICS</text>
      <circle cx="120" cy="128" r="2" fill="#7CC4A0" />
    </svg>
  )
}

export function ProductPreview() {
  const { t } = useI18n()
  const p = t.home.preview
  const rows = [
    [p.productLabel, `${p.brand} · ${p.product}`],
    [p.audienceLabel, p.audience],
    [p.typeLabel, p.type],
    [p.toneLabel, p.tone],
  ]
  return (
    <figure aria-label={p.ariaLabel} className="card relative overflow-hidden !rounded-2xl shadow-[var(--shadow-lift)]">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        </div>
        <span className="truncate text-xs font-medium text-muted">{p.windowTitle}</span>
        <DemoBadge label={t.common.demoBadge} />
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[0.9fr_1.1fr] sm:p-5">
        <div className="space-y-2.5">
          <div className="overflow-hidden rounded-xl border border-line">
            <ProductVisual className="block h-auto w-full" />
          </div>
          <dl className="space-y-2">
            {rows.map(([k, v]) => (
              <div key={k} className="rounded-lg border border-line bg-bg px-3 py-2">
                <dt className="text-[10px] font-semibold tracking-wide text-muted uppercase">{k}</dt>
                <dd className="truncate text-xs font-medium text-fg">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-brand/25 bg-brand-soft/50 p-4">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-fg">
              <Icon name="sparkles" className="h-3.5 w-3.5" />
              {p.resultLabel}
            </div>
            <p className="mt-2 font-display text-base font-bold text-fg">{p.resultTitle}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{p.resultBody}</p>
            <p className="mt-3 inline-flex rounded-md bg-surface px-2 py-1 text-[11px] font-semibold text-fg">{p.cta}</p>
          </div>
          <div className="relative flex-1 overflow-hidden rounded-xl border border-line bg-[#0B1020] p-3">
            <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{p.imageLabel}</div>
            <div className="mt-2 grid grid-cols-2 gap-2" aria-hidden="true">
              <div className="aspect-[4/5] overflow-hidden rounded-lg bg-[linear-gradient(160deg,#F2E9DF,#E3D3C2)]">
                <ProductVisual className="h-full w-full object-cover opacity-90 mix-blend-multiply" />
              </div>
              <div className="aspect-[4/5] overflow-hidden rounded-lg bg-[linear-gradient(160deg,#E1E7FF,#C9D2F7)]">
                <ProductVisual className="h-full w-full opacity-90 mix-blend-multiply" />
              </div>
            </div>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white">
              <Icon name="layout" className="h-3.5 w-3.5" />
              {p.edit}
            </span>
          </div>
        </div>
      </div>
      <figcaption className="border-t border-line px-4 py-2 text-[11px] text-muted">{p.fictional}</figcaption>
    </figure>
  )
}
