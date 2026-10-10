import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PROJECT_STATUSES, type CampaignResult, type TextVariant } from '../../../shared/options'
import { useI18n } from '../../i18n'
import { Icon } from '../../components/Icon'
import { del, put } from '../../lib/api'
import { downloadAs } from '../../lib/imageTools'
import { getLocalImage, type LocalImage } from '../../lib/localImages'
import { useApp } from '../AppContext'
import { PageLoader } from '../AppRoot'
import { CampaignEditor, TextVariants } from '../editors'
import { useFetch, type ProjectSummary } from '../hooks'
import { Alert, ConfirmDialog, formatDate, Select, TextInput, useErrorMessage } from '../ui'
import { CampaignActions } from './Campaigns'

type Content = {
  input?: Record<string, unknown>
  results?: { generationId: string; createdAt: string; variants: TextVariant[] }[]
  campaign?: CampaignResult
  images?: { generationId: string; createdAt: string; width: number; height: number; aspect: string }[]
}
type Project = ProjectSummary & { content: Content }

export default function ProjectDetail() {
  const { id } = useParams()
  const { t, lang } = useI18n()
  const p = t.app.projects
  const o = t.app.options
  const { toast } = useApp()
  const msg = useErrorMessage()
  const navigate = useNavigate()
  const { data, error, loading, setData } = useFetch<{ project: Project }>(`/api/projects/${id}`)
  const [title, setTitle] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (data) setTitle(data.project.title)
  }, [data])

  if (loading) return <PageLoader />
  if (error || !data) return <Alert {...msg(error)} title={p.notFound} />
  const project = data.project
  const setContent = (content: Content) => setData({ project: { ...project, content } })

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true)
    try {
      await put(`/api/projects/${project.id}`, body)
      setData({ project: { ...project, ...(body as Partial<Project>) } })
      toast({ tone: 'success', ...t.app.common.saved })
    } catch (e) {
      toast({ tone: 'danger', ...msg(e) })
    } finally {
      setSaving(false)
    }
  }
  const remove = async () => {
    try {
      await del(`/api/projects/${project.id}`)
      navigate('/app/projects', { replace: true })
    } catch (e) {
      toast({ tone: 'danger', ...msg(e) })
    }
  }

  return (
    <>
      <div className="mb-6">
        <Link to="/app/projects" className="text-sm font-semibold text-brand-fg hover:underline">
          ← {t.app.nav.projects}
        </Link>
      </div>
      <div className="card mb-6 grid gap-4 p-5 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div>
          <label htmlFor="pd-title" className="label">
            {p.rename}
          </label>
          <div className="flex gap-2">
            <TextInput id="pd-title" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} />
            <button type="button" className="btn-secondary shrink-0" disabled={saving || !title.trim() || title === project.title} onClick={() => patch({ title })}>
              {t.app.common.save}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            {o.projectTypes[project.type]} · {p.updated}: {formatDate(project.updatedAt, lang)}
          </p>
        </div>
        <div>
          <label htmlFor="pd-status" className="label">
            {p.status}
          </label>
          <Select id="pd-status" options={PROJECT_STATUSES} labels={o.projectStatuses} value={project.status} onChange={(e) => patch({ status: e.target.value })} />
        </div>
        <button type="button" className="btn-ghost text-danger" onClick={() => setConfirm(true)}>
          {t.app.common.delete}
        </button>
      </div>

      {project.type === 'text' && (
        <section className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={() => patch({ content: project.content })}>
              {t.app.common.save}
            </button>
            <Link to={`/app/create?project=${project.id}`} className="btn-secondary">
              <Icon name="sparkles" className="h-4 w-4" />
              {p.generateMore}
            </Link>
          </div>
          {(project.content.results ?? []).map((r, i) => (
            <div key={r.generationId} className="card p-5">
              <p className="mb-3 text-xs text-muted">{formatDate(r.createdAt, lang)}</p>
              <TextVariants
                variants={r.variants}
                onChange={(variants) =>
                  setContent({ ...project.content, results: project.content.results!.map((x, j) => (j === i ? { ...x, variants } : x)) })
                }
              />
            </div>
          ))}
        </section>
      )}

      {project.type === 'campaign' && project.content.campaign && (
        <section className="card p-5 sm:p-6">
          <div className="mb-4">
            <CampaignActions projectId={project.id} value={project.content.campaign} extra={project.content} />
          </div>
          <CampaignEditor value={project.content.campaign} onChange={(campaign) => setContent({ ...project.content, campaign })} />
        </section>
      )}

      {project.type === 'image' && <ImageList images={project.content.images ?? []} />}

      <ConfirmDialog
        open={confirm}
        title={t.app.common.deleteConfirm.title}
        body={t.app.common.deleteConfirm.body}
        confirmLabel={t.app.common.delete}
        onConfirm={remove}
        onClose={() => setConfirm(false)}
      />
    </>
  )
}

function ImageList({ images }: { images: NonNullable<Content['images']> }) {
  const { t, lang } = useI18n()
  const [local, setLocal] = useState<Record<string, LocalImage | null>>({})
  useEffect(() => {
    Promise.all(images.map((i) => getLocalImage(i.generationId).catch(() => undefined))).then((found) =>
      setLocal(Object.fromEntries(images.map((i, k) => [i.generationId, found[k] ?? null]))),
    )
  }, [images])
  const urls = useMemo(() => Object.fromEntries(Object.entries(local).map(([k, v]) => [k, v ? URL.createObjectURL(v.blob) : null])), [local])
  useEffect(() => () => Object.values(urls).forEach((u) => u && URL.revokeObjectURL(u)), [urls])
  return (
    <section>
      <p className="mb-4 text-xs text-muted">{t.app.image.localWarning}</p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((img) => {
          const l = local[img.generationId]
          return (
            <li key={img.generationId} className="card overflow-hidden">
              {l && urls[img.generationId] ? (
                <>
                  <img src={urls[img.generationId]!} alt={l.prompt} className="w-full" />
                  <div className="flex gap-2 p-3">
                    <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => downloadAs(l.blob, 'png', `pixo-${img.generationId.slice(0, 8)}`)}>
                      PNG
                    </button>
                    <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => downloadAs(l.blob, 'jpg', `pixo-${img.generationId.slice(0, 8)}`)}>
                      JPG
                    </button>
                  </div>
                </>
              ) : (
                <p className="p-5 text-sm text-muted">{t.app.image.notOnDevice}</p>
              )}
              <p className="border-t border-line px-3 py-2 text-xs text-muted">
                {img.aspect} · {formatDate(img.createdAt, lang)}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
