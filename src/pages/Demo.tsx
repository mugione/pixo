import { useState } from 'react'
import { Link } from 'react-router'
import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { ProductVisual } from '../components/ProductPreview'
import { DemoBadge, Notice, PageHero } from '../components/ui'

export default function Demo() {
  const { t, to } = useI18n()
  const d = t.demo
  const [tab, setTab] = useState(0)
  const [copied, setCopied] = useState(false)
  const current = d.tabs[tab]

  const copy = async () => {
    const text = [current.heading, current.body, current.cta, current.tags.join(' ')].filter(Boolean).join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard may be blocked; the text remains selectable */
    }
  }

  const fields = Object.keys(d.fields) as (keyof typeof d.fields)[]

  return (
    <>
      <PageHero eyebrow={<DemoBadge label={t.common.demoBadge} />} title={d.title} lead={d.lead} />
      <section className="section">
        <div className="container-page space-y-6">
          <Notice tone="warning">{d.banner}</Notice>
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
            <section className="card p-6" aria-labelledby="demo-input">
              <h2 id="demo-input" className="text-lg font-bold">{d.inputTitle}</h2>
              <div className="mt-5 overflow-hidden rounded-xl border border-line">
                <ProductVisual className="block h-auto w-full" />
              </div>
              <dl className="mt-5 space-y-3">
                {fields.map((k) => (
                  <div key={k}>
                    <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{d.fields[k]}</dt>
                    <dd className="mt-0.5 text-sm font-medium">{d.sample[k]}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="card p-6" aria-labelledby="demo-output">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="demo-output" className="text-lg font-bold">{d.outputTitle}</h2>
                <DemoBadge label={t.common.demoBadge} />
              </div>
              <div role="tablist" aria-label={d.tabsLabel} className="mt-5 flex flex-wrap gap-2">
                {d.tabs.map((tb, i) => (
                  <button
                    key={tb.label}
                    role="tab"
                    id={`demo-tab-${i}`}
                    aria-selected={i === tab}
                    aria-controls="demo-panel"
                    tabIndex={i === tab ? 0 : -1}
                    onClick={() => {
                      setTab(i)
                      setCopied(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
                      const n = (i + (e.key === 'ArrowRight' ? 1 : d.tabs.length - 1)) % d.tabs.length
                      setTab(n)
                      document.getElementById(`demo-tab-${n}`)?.focus()
                    }}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                      i === tab ? 'bg-brand text-white' : 'bg-surface-2 text-muted hover:text-fg'
                    }`}
                  >
                    {tb.label}
                  </button>
                ))}
              </div>
              <div id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${tab}`} className="mt-5 rounded-xl border border-brand/25 bg-brand-soft/40 p-5 sm:p-6">
                <p className="font-display text-xl font-bold">{current.heading}</p>
                <p className="mt-3 leading-relaxed text-muted">{current.body}</p>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{d.ctaLabel}</dt>
                    <dd className="mt-1 inline-flex rounded-lg bg-surface px-3 py-1.5 text-sm font-semibold">{current.cta}</dd>
                  </div>
                  {current.tags.length > 0 && (
                    <div>
                      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{d.tagsLabel}</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {current.tags.map((tg) => (
                          <span key={tg} className="rounded-md bg-surface px-2 py-1 font-mono text-xs">{tg}</span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
                <button type="button" onClick={copy} className="btn-secondary mt-6 !px-4 !py-2">
                  <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4" />
                  <span aria-live="polite">{copied ? d.copied : d.copy}</span>
                </button>
              </div>
            </section>
          </div>
          <div className="card flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">{d.nextTitle}</h2>
              <p className="mt-2 text-sm text-muted">{d.nextBody}</p>
            </div>
            <Link to={to('signup')} className="btn-primary shrink-0">
              {t.common.nav.start}
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
