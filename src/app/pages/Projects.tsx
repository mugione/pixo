import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PROJECT_STATUSES, PROJECT_TYPES } from '../../../shared/options'
import { useI18n } from '../../i18n'
import { PageLoader } from '../AppRoot'
import { useFetch, type ProjectSummary } from '../hooks'
import { Alert, PageHeader, Select, useErrorMessage } from '../ui'
import { ProjectRow } from './Dashboard'

export default function Projects() {
  const { t } = useI18n()
  const p = t.app.projects
  const o = t.app.options
  const msg = useErrorMessage()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState<'updated' | 'created' | 'title'>('updated')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 250)
    return () => clearTimeout(id)
  }, [q])
  const qs = new URLSearchParams({ sort, ...(debounced ? { q: debounced } : {}), ...(type ? { type } : {}), ...(status ? { status } : {}) })
  const { data, error, loading } = useFetch<{ projects: ProjectSummary[] }>(`/api/projects?${qs}`)
  const filtered = !!(debounced || type || status)

  return (
    <>
      <PageHeader
        title={p.title}
        actions={
          <Link to="/app/create" className="btn-primary">
            {p.create}
          </Link>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input type="search" className="input" placeholder={p.search} aria-label={p.search} value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label={p.type} options={PROJECT_TYPES} labels={o.projectTypes} placeholder={p.allTypes} value={type} onChange={(e) => setType(e.target.value)} />
        <Select aria-label={p.status} options={PROJECT_STATUSES} labels={o.projectStatuses} placeholder={p.allStatuses} value={status} onChange={(e) => setStatus(e.target.value)} />
        <Select aria-label={p.sortLabel} options={['updated', 'created', 'title'] as const} labels={p.sort} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} />
      </div>
      {loading && !data ? (
        <PageLoader />
      ) : error ? (
        <Alert {...msg(error)} />
      ) : data && data.projects.length ? (
        <ul className="card divide-y divide-line overflow-hidden">
          {data.projects.map((x) => (
            <ProjectRow key={x.id} p={x} />
          ))}
        </ul>
      ) : filtered ? (
        <div className="card p-10 text-center text-muted">{p.noMatch}</div>
      ) : (
        <div className="card p-10 text-center">
          <h2 className="text-lg font-bold">{p.emptyTitle}</h2>
          <p className="mt-2 text-muted">{p.emptyBody}</p>
          <Link to="/app/create" className="btn-primary mt-6">
            {p.create}
          </Link>
        </div>
      )}
    </>
  )
}
