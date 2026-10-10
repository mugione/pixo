import { Link } from 'react-router'
import { fill, useI18n } from '../../i18n'
import { Icon, type IconName } from '../../components/Icon'
import { PageLoader } from '../AppRoot'
import { useFetch, type ProjectSummary } from '../hooks'
import { Alert, formatDate, PageHeader, useErrorMessage } from '../ui'

type Stats = {
  totalProjects: number
  generatedContent: number
  completedCampaigns: number
  remainingText: number
  remainingImage: number
  recentProjects: ProjectSummary[]
}

export function ProjectRow({ p }: { p: ProjectSummary }) {
  const { t, lang } = useI18n()
  const o = t.app.options
  return (
    <li>
      <Link to={`/app/projects/${p.id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{p.title}</p>
          <p className="mt-0.5 text-xs text-muted">
            {o.projectTypes[p.type]} · {formatDate(p.updatedAt, lang)}
          </p>
        </div>
        <StatusBadge status={p.status} />
      </Link>
    </li>
  )
}

export function StatusBadge({ status }: { status: ProjectSummary['status'] }) {
  const { t } = useI18n()
  const cls = { draft: 'bg-surface-2 text-muted', in_progress: 'bg-brand-soft text-brand-fg', completed: 'bg-success/15 text-[#047857] dark:text-success' }[status]
  return <span className={`badge ${cls}`}>{t.app.options.projectStatuses[status]}</span>
}

export default function Dashboard() {
  const { t } = useI18n()
  const d = t.app.dashboard
  const { data, error, loading } = useFetch<Stats>('/api/user/stats')
  const msg = useErrorMessage()
  if (loading) return <PageLoader />
  if (error || !data) return <Alert {...msg(error)} />

  const stats = [
    { label: d.stats.projects, value: data.totalProjects },
    { label: d.stats.content, value: data.generatedContent },
    { label: d.stats.campaigns, value: data.completedCampaigns },
    { label: d.stats.remaining, value: data.remainingText + data.remainingImage, sub: fill(d.remainingDetail, { text: String(data.remainingText), image: String(data.remainingImage) }) },
  ]
  const quick: { to: string; label: string; icon: IconName }[] = [
    { to: '/app/create', label: d.quick.content, icon: 'sparkles' },
    { to: '/app/create?tab=image', label: d.quick.image, icon: 'image' },
    { to: '/app/campaigns', label: d.quick.campaign, icon: 'megaphone' },
    { to: '/app/brand', label: d.quick.brand, icon: 'palette' },
  ]

  return (
    <>
      <PageHeader title={d.title} lead={d.lead} />
      <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="mt-2 font-display text-3xl font-bold">{s.value}</dd>
            {s.sub && <dd className="mt-1 text-xs text-muted">{s.sub}</dd>}
          </div>
        ))}
      </dl>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quick.map((q) => (
          <li key={q.to}>
            <Link to={q.to} className="card flex items-center gap-3 p-4 font-semibold transition-shadow hover:shadow-[var(--shadow-lift)]">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-fg">
                <Icon name={q.icon} />
              </span>
              {q.label}
            </Link>
          </li>
        ))}
      </ul>
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{d.recent}</h2>
          {data.recentProjects.length > 0 && (
            <Link to="/app/projects" className="text-sm font-semibold text-brand-fg hover:underline">
              {d.viewAll}
            </Link>
          )}
        </div>
        {data.recentProjects.length ? (
          <ul className="card divide-y divide-line overflow-hidden">
            {data.recentProjects.map((p) => (
              <ProjectRow key={p.id} p={p} />
            ))}
          </ul>
        ) : (
          <div className="card p-10 text-center">
            <h3 className="text-lg font-bold">{d.emptyTitle}</h3>
            <p className="mt-2 text-muted">{d.emptyBody}</p>
            <Link to="/app/create" className="btn-primary mt-6">
              {d.emptyCta}
            </Link>
          </div>
        )}
      </section>
    </>
  )
}
