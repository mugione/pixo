import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { PageHero } from '../components/ui'

const STATUS_CLS = {
  done: 'bg-success/15 text-[#047857] dark:text-success',
  inProgress: 'bg-brand-soft text-brand-fg',
  planned: 'bg-surface-2 text-muted',
} as const

export default function Roadmap() {
  const { t } = useI18n()
  const r = t.roadmap
  return (
    <>
      <PageHero title={r.title} lead={r.lead} />
      <section className="section">
        <div className="container-page">
          <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {r.phases.map((phase) => (
              <li key={phase.name} className="card p-6">
                <h2 className="text-lg font-bold">{phase.name}</h2>
                <ul className="mt-5 space-y-2.5">
                  {phase.items.map((item) => (
                    <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2">
                        {item.status === 'done' ? (
                          <Icon name="check" className="h-4 w-4 shrink-0 text-success" strokeWidth={2.4} />
                        ) : (
                          <span className="ml-1 h-2 w-2 shrink-0 rounded-full bg-line" aria-hidden="true" />
                        )}
                        {item.label}
                      </span>
                      <span className={`badge shrink-0 ${STATUS_CLS[item.status]}`}>{r.status[item.status]}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  )
}
