import { Link } from 'react-router'
import { useI18n } from '../../i18n'
import { PageLoader } from '../AppRoot'
import { useFetch } from '../hooks'
import { Alert, formatDate, PageHeader, useErrorMessage } from '../ui'

type Gen = {
  id: string
  type: 'text' | 'campaign' | 'image'
  model: string
  status: 'pending' | 'succeeded' | 'failed'
  preview: string | null
  projectId: string | null
  projectTitle: string | null
  createdAt: string
}

export default function History() {
  const { t, lang } = useI18n()
  const h = t.app.history
  const { data, error, loading } = useFetch<{ generations: Gen[] }>('/api/user/history')
  const msg = useErrorMessage()
  if (loading) return <PageLoader />
  if (error || !data) return <Alert {...msg(error)} />
  const statusCls = { pending: 'bg-brand-soft text-brand-fg', succeeded: 'bg-success/15 text-[#047857] dark:text-success', failed: 'bg-danger/10 text-danger' }
  const preview = (g: Gen) => {
    if (!g.preview) return ''
    if (g.type === 'image') return g.preview
    try {
      const o = JSON.parse(g.preview)
      return o.variants?.[0]?.title ?? o.name ?? ''
    } catch {
      return g.preview.replace(/[{}"[\]]/g, ' ').slice(0, 160) // preview is truncated JSON
    }
  }
  return (
    <>
      <PageHeader title={h.title} lead={h.lead} />
      {data.generations.length === 0 ? (
        <div className="card p-10 text-center text-muted">{h.empty}</div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {data.generations.map((g) => (
            <li key={g.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {t.app.options.projectTypes[g.type]}
                  {g.projectId && g.projectTitle && (
                    <>
                      {' · '}
                      <Link to={`/app/projects/${g.projectId}`} className="text-brand-fg hover:underline">
                        {g.projectTitle}
                      </Link>
                    </>
                  )}
                </p>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted">{preview(g)}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted">
                  {formatDate(g.createdAt, lang)} · {g.model}
                </p>
              </div>
              <span className={`badge self-start sm:self-center ${statusCls[g.status]}`}>{h.status[g.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
