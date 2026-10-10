import { useI18n } from '../i18n'
import { PageHero } from '../components/ui'

export default function About() {
  const { t } = useI18n()
  const a = t.about
  return (
    <>
      <PageHero title={a.title} />
      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-5 text-lg leading-relaxed text-muted">
            {a.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <div className="space-y-5">
            <div className="card p-6">
              <h2 className="text-sm font-semibold tracking-wide text-brand-fg uppercase">{a.missionTitle}</h2>
              <p className="mt-3 text-base font-medium">{a.mission}</p>
            </div>
            <div className="card p-6">
              <h2 className="text-sm font-semibold tracking-wide text-brand-fg uppercase">{a.visionTitle}</h2>
              <p className="mt-3 text-base font-medium">{a.vision}</p>
            </div>
          </div>
        </div>
      </section>
      <section className="section border-t border-line bg-bg-subtle">
        <div className="container-page">
          <h2 className="section-title">{a.valuesTitle}</h2>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {a.values.map((v) => (
              <li key={v.title} className="card p-5">
                <h3 className="text-base font-bold">{v.title}</h3>
                <p className="mt-2 text-sm text-muted">{v.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
