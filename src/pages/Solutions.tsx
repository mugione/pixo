import { useI18n } from '../i18n'
import type { IconName } from '../components/Icon'
import { CtaBand, IconTile, PageHero, SectionHeading } from '../components/ui'

const AUDIENCE_ICONS: IconName[] = ['bag', 'building', 'share', 'users', 'rocket']
const USE_ICONS: IconName[] = ['bag', 'share', 'target', 'shield']

export default function Solutions() {
  const { t, to } = useI18n()
  const s = t.solutions
  return (
    <>
      <PageHero title={s.title} lead={s.lead} />
      <section className="section">
        <div className="container-page">
          <SectionHeading title={s.useCasesTitle} />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {t.home.solutions.items.map((u, i) => (
              <li key={u.title} className="card p-6">
                <IconTile name={USE_ICONS[i]} />
                <h3 className="mt-5 text-lg font-bold">{u.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{u.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="section border-t border-line bg-bg-subtle">
        <div className="container-page">
          <SectionHeading title={s.audiencesTitle} />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {s.audiences.map((a, i) => (
              <li key={a.title} className="card p-6">
                <IconTile name={AUDIENCE_ICONS[i]} />
                <h3 className="mt-5 text-lg font-bold">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{a.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <CtaBand title={t.home.final.title} lead={t.home.final.lead} cta={t.home.final.cta} to={to('signup')} />
    </>
  )
}
