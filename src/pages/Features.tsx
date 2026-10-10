import { Link } from 'react-router'
import { useI18n } from '../i18n'
import type { IconName } from '../components/Icon'
import { Icon } from '../components/Icon'
import { CtaBand, IconTile, Notice, PageHero } from '../components/ui'

const ICONS: IconName[] = ['sparkles', 'image', 'megaphone', 'palette', 'layout']

export default function Features() {
  const { t, to } = useI18n()
  const f = t.features
  return (
    <>
      <PageHero title={f.title} lead={f.lead}>
        <div className="mt-8">
          <Notice>{f.statusNote}</Notice>
        </div>
      </PageHero>
      <section className="section">
        <div className="container-page space-y-6">
          {f.items.map((item, i) => (
            <article key={item.tag} id={item.tag.toLowerCase().replace(/\s+/g, '-')} className="card grid gap-6 p-6 sm:p-8 md:grid-cols-[auto_1fr]">
              <IconTile name={ICONS[i]} />
              <div>
                <p className="font-mono text-xs font-semibold tracking-wide text-brand-fg uppercase">{item.tag}</p>
                <h2 className="mt-2 text-2xl font-bold">{item.title}</h2>
                <p className="mt-3 max-w-2xl text-muted">{item.body}</p>
                {item.list.length > 0 && (
                  <>
                    <h3 className="mt-6 text-sm font-semibold">{item.listTitle}</h3>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {item.list.map((l) => (
                        <li key={l} className="flex items-center gap-2 rounded-lg border border-line bg-bg-subtle px-3 py-2 text-sm">
                          <Icon name="check" className="h-4 w-4 shrink-0 text-success" strokeWidth={2.2} />
                          {l}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {item.note && (
                  <div className="mt-6">
                    <Notice tone="warning">{item.note}</Notice>
                  </div>
                )}
              </div>
            </article>
          ))}
          <p className="pt-4 text-center text-sm text-muted">
            <Link to={to('roadmap')} className="font-semibold text-brand-fg hover:underline">
              {t.common.footer.roadmap} →
            </Link>
          </p>
        </div>
      </section>
      <CtaBand title={t.home.final.title} lead={t.home.final.lead} cta={t.home.final.cta} to={to('signup')} />
    </>
  )
}
