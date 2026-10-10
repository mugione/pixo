import { Link } from 'react-router'
import { useI18n } from '../i18n'
import type { PageId } from '../i18n/routes'
import { Logo } from './Logo'

export function Footer() {
  const { lang, t, to } = useI18n()
  const f = t.common.footer
  const cols: { title: string; links: { label: string; page: PageId }[] }[] = [
    {
      title: f.product,
      links: [
        { label: t.common.nav.features, page: 'features' },
        { label: t.common.nav.howItWorks, page: 'howItWorks' },
        { label: f.demo, page: 'demo' },
        { label: t.common.nav.pricing, page: 'pricing' },
      ],
    },
    {
      title: f.company,
      links: [
        { label: t.common.nav.about, page: 'about' },
        { label: f.roadmap, page: 'roadmap' },
        { label: f.contact, page: 'contact' },
      ],
    },
    {
      title: f.support,
      links: [
        { label: f.faq, page: 'faq' },
        { label: f.privacy, page: 'privacy' },
        { label: f.terms, page: 'terms' },
        { label: f.kvkk, page: 'kvkk' },
        { label: f.cookies, page: 'cookies' },
      ],
    },
  ]
  return (
    <footer className="border-t border-line bg-bg-subtle">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Link to={to('home')} className="inline-block rounded-lg" aria-label="Pixo AI">
            <Logo />
          </Link>
          <p className="mt-4 max-w-xs text-sm text-muted">Create smarter. Market faster.</p>
          {lang === 'tr' && <p className="mt-1 max-w-xs text-sm text-muted">{t.common.brandTagline}</p>}
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h2 className="text-sm font-semibold text-fg">{c.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {c.links.map((l) => (
                <li key={l.page}>
                  <Link to={to(l.page)} className="text-sm text-muted transition-colors hover:text-fg">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>{f.rights}</p>
          <p>{f.earlyStage}</p>
        </div>
      </div>
    </footer>
  )
}
