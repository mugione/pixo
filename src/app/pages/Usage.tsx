import { useI18n } from '../../i18n'
import { PageLoader } from '../AppRoot'
import { useUsage } from '../hooks'
import { Alert, formatDate, PageHeader, useErrorMessage } from '../ui'

export default function Usage() {
  const { t, lang } = useI18n()
  const u = t.app.usage
  const { data, error, loading } = useUsage()
  const msg = useErrorMessage()
  if (loading) return <PageLoader />
  if (error || !data) return <Alert {...msg(error)} />
  const rows = [
    [u.textUsed, `${data.text.used} / ${data.text.limit}`],
    [u.textLeft, String(data.text.remaining)],
    [u.imageUsed, `${data.image.used} / ${data.image.limit}`],
    [u.imageLeft, String(data.image.remaining)],
    [u.lastUsed, data.lastUsedAt ? formatDate(data.lastUsedAt, lang) : u.never],
    [u.resets, formatDate(data.resetsAt, lang)],
  ]
  const bar = (used: number, limit: number) => (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" role="presentation">
      <div className="h-full rounded-full bg-brand" style={{ width: `${limit ? Math.min(100, (used / limit) * 100) : 100}%` }} />
    </div>
  )
  return (
    <>
      <PageHeader title={u.title} />
      <div className="space-y-4">
        {!data.aiEnabled && <Alert tone="warning" {...t.app.common.aiDisabled} />}
        {data.aiEnabled && (!data.systemCapacity.text || !data.systemCapacity.image) && <Alert tone="warning" title={u.systemFull} />}
        {data.text.remaining === 0 && data.image.remaining === 0 && <Alert tone="warning" {...t.app.common.quota} />}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-sm text-muted">{u.textUsed}</p>
          <p className="mt-1 font-display text-3xl font-bold">
            {data.text.used} <span className="text-lg text-muted">/ {data.text.limit}</span>
          </p>
          {bar(data.text.used, data.text.limit)}
        </div>
        <div className="card p-5">
          <p className="text-sm text-muted">{u.imageUsed}</p>
          <p className="mt-1 font-display text-3xl font-bold">
            {data.image.used} <span className="text-lg text-muted">/ {data.image.limit}</span>
          </p>
          {bar(data.image.used, data.image.limit)}
        </div>
      </div>
      <dl className="card mt-4 divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-muted">{u.note}</p>
    </>
  )
}
