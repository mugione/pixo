import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  ASPECTS,
  CATEGORIES,
  CONTENT_TYPES,
  GOALS,
  LANGUAGES,
  LENGTHS,
  SCENES,
  STYLES,
  TONES,
  type Aspect,
  type Scene,
  type Style,
  type TextResult,
  type TextVariant,
} from '../../../shared/options'
import { fill, useI18n } from '../../i18n'
import { Icon } from '../../components/Icon'
import { api, ApiError, newIdempotencyKey, post, put } from '../../lib/api'
import { ACCEPTED_TYPES, base64ToBlob, downloadAs, toReferenceJpeg } from '../../lib/imageTools'
import { deleteLocalImage, listLocalImages, saveLocalImage, type LocalImage } from '../../lib/localImages'
import { useApp } from '../AppContext'
import { TextVariants } from '../editors'
import { useBrands, useUsage, type Usage } from '../hooks'
import { Alert, Field, PageHeader, Select, Spinner, TextArea, TextInput, useErrorMessage } from '../ui'

export default function Studio() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'image' ? 'image' : 'text'
  const usage = useUsage()
  const tabCls = (active: boolean) => `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${active ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'}`
  return (
    <>
      <PageHeader
        title={t.app.studio.title}
        actions={
          <div role="tablist" className="inline-flex rounded-xl bg-surface-2 p-1">
            <button role="tab" aria-selected={tab === 'text'} className={tabCls(tab === 'text')} onClick={() => setParams({})}>
              {t.app.studio.tabText}
            </button>
            <button role="tab" aria-selected={tab === 'image'} className={tabCls(tab === 'image')} onClick={() => setParams({ tab: 'image' })}>
              {t.app.studio.tabImage}
            </button>
          </div>
        }
      />
      {usage.data?.announcement && (
        <div className="mb-4">
          <Alert tone="info" title={usage.data.announcement} />
        </div>
      )}
      {tab === 'text' ? <TextStudio usage={usage.data} onUsed={usage.reload} /> : <ImageStudio usage={usage.data} onUsed={usage.reload} />}
    </>
  )
}

function QuotaLine({ remaining }: { remaining: number | undefined }) {
  const { t } = useI18n()
  if (remaining === undefined) return null
  return <p className="text-xs text-muted">{fill(t.app.common.remainingToday, { n: String(remaining) })}</p>
}

type TextForm = {
  title: string
  brandId: string
  productName: string
  productDescription: string
  category: (typeof CATEGORIES)[number]
  audience: string
  goal: string
  contentType: string
  tone: string
  language: (typeof LANGUAGES)[number]
  length: (typeof LENGTHS)[number]
}

type TextProject = { id: string; content: { input?: Record<string, unknown>; results?: { generationId: string; createdAt: string; variants: TextVariant[] }[] } }

function TextStudio({ usage, onUsed }: { usage: Usage | null; onUsed: () => void }) {
  const { t, lang } = useI18n()
  const s = t.app.studio
  const o = t.app.options
  const { toast } = useApp()
  const msg = useErrorMessage()
  const [params] = useSearchParams()
  const brands = useBrands()
  const presetType = CONTENT_TYPES.find((c) => c === params.get('type'))
  const [form, setForm] = useState<TextForm>({
    title: '',
    brandId: '',
    productName: '',
    productDescription: '',
    category: 'other',
    audience: '',
    goal: 'product_intro',
    contentType: presetType ?? 'instagram_post',
    tone: 'professional',
    language: lang,
    length: 'medium',
  })
  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [project, setProject] = useState<TextProject | null>(null)
  const [saving, setSaving] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Default brand, and prefill from an existing project (?project=…).
  useEffect(() => {
    const def = brands.data?.brands.find((b) => b.isDefault)
    if (def) setForm((f) => (f.brandId ? f : { ...f, brandId: def.id, audience: f.audience || def.targetAudience || '' }))
  }, [brands.data])
  useEffect(() => {
    const id = params.get('project')
    if (!id) return
    api<{ project: TextProject & { title: string } }>(`/api/projects/${id}`)
      .then(({ project: p }) => {
        setProject(p)
        const i = (p.content.input ?? {}) as Record<string, unknown> & { product?: Record<string, string> }
        setForm((f) => ({
          ...f,
          title: p.title,
          brandId: (i.brandId as string) ?? f.brandId,
          productName: i.product?.name ?? f.productName,
          productDescription: i.product?.description ?? f.productDescription,
          category: (i.product?.category as TextForm['category']) ?? f.category,
          audience: (i.audience as string) ?? f.audience,
          goal: (i.goal as string) ?? f.goal,
          contentType: (i.contentType as string) ?? f.contentType,
          tone: (i.tone as string) ?? f.tone,
          language: (i.language as TextForm['language']) ?? f.language,
          length: (i.length as TextForm['length']) ?? f.length,
        }))
      })
      .catch(() => {})
  }, [params])

  const set = <K extends keyof TextForm>(k: K, v: TextForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setFieldErrors((e) => e.filter((x) => x !== k))
  }

  const generate = async (e?: FormEvent) => {
    e?.preventDefault()
    const errs: string[] = []
    if (form.productName.trim().length < 2) errs.push('productName')
    if (form.productDescription.trim().length < 10) errs.push('productDescription')
    setFieldErrors(errs)
    if (errs.length) {
      document.getElementById(`s-${errs[0]}`)?.focus()
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await post<{ projectId: string; generationId: string; result: TextResult }>(
        '/api/ai/generate-text',
        {
          title: form.title,
          brandId: form.brandId || null,
          projectId: project?.id ?? null,
          product: { name: form.productName, description: form.productDescription, category: form.category },
          audience: form.audience,
          goal: form.goal,
          contentType: form.contentType,
          tone: form.tone,
          language: form.language,
          length: form.length,
        },
        { 'Idempotency-Key': newIdempotencyKey() },
      )
      const { project: p } = await api<{ project: TextProject }>(`/api/projects/${r.projectId}`)
      setProject(p)
      toast({ tone: 'success', ...t.app.common.ready })
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'validation_error') setFieldErrors(err.fields)
      setError(err)
    } finally {
      setBusy(false)
      onUsed()
    }
  }

  const latest = project?.content.results?.[0]
  const updateLatest = (variants: TextVariant[]) =>
    setProject((p) => (p && p.content.results ? { ...p, content: { ...p.content, results: [{ ...p.content.results[0], variants }, ...p.content.results.slice(1)] } } : p))

  const save = async () => {
    if (!project) return
    setSaving(true)
    try {
      await put(`/api/projects/${project.id}`, { content: project.content })
      toast({ tone: 'success', ...t.app.common.saved })
    } catch (err) {
      toast({ tone: 'danger', ...msg(err) })
    } finally {
      setSaving(false)
    }
  }

  const fe = (k: keyof typeof s.fieldErrors) => (fieldErrors.includes(k) ? s.fieldErrors[k] : undefined)
  const blocked = usage && (!usage.aiEnabled || usage.text.remaining === 0 || !usage.systemCapacity.text)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <form noValidate onSubmit={generate} className="card space-y-4 p-5 sm:p-6" aria-labelledby="studio-settings">
        <h2 id="studio-settings" className="text-base font-bold">
          {s.settings}
        </h2>
        <Field id="s-title" label={s.projectName} optional>
          <TextInput id="s-title" value={form.title} maxLength={150} placeholder={s.projectNamePh} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field id="s-brand" label={s.brand}>
          <select id="s-brand" className="input" value={form.brandId} onChange={(e) => set('brandId', e.target.value)}>
            <option value="">{s.noBrand}</option>
            {brands.data?.brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="s-productName" label={s.productName} error={fe('productName')}>
          <TextInput id="s-productName" value={form.productName} maxLength={150} placeholder={s.productNamePh} error={fe('productName')} onChange={(e) => set('productName', e.target.value)} />
        </Field>
        <Field id="s-productDescription" label={s.productDescription} error={fe('productDescription')}>
          <TextArea
            id="s-productDescription"
            rows={4}
            maxLength={2000}
            value={form.productDescription}
            placeholder={s.productDescriptionPh}
            error={fe('productDescription')}
            onChange={(e) => set('productDescription', e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="s-category" label={s.category}>
            <Select id="s-category" options={CATEGORIES} labels={o.categories} value={form.category} onChange={(e) => set('category', e.target.value as TextForm['category'])} />
          </Field>
          <Field id="s-goal" label={s.goal} error={fe('goal')}>
            <Select id="s-goal" options={GOALS} labels={o.goals} value={form.goal} onChange={(e) => set('goal', e.target.value)} />
          </Field>
        </div>
        <Field id="s-audience" label={s.audience} optional>
          <TextInput id="s-audience" value={form.audience} maxLength={300} placeholder={s.audiencePh} onChange={(e) => set('audience', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="s-contentType" label={s.contentType}>
            <Select id="s-contentType" options={CONTENT_TYPES} labels={o.contentTypes} value={form.contentType} onChange={(e) => set('contentType', e.target.value)} />
          </Field>
          <Field id="s-tone" label={s.tone}>
            <Select id="s-tone" options={TONES} labels={o.tones} value={form.tone} onChange={(e) => set('tone', e.target.value)} />
          </Field>
          <Field id="s-language" label={s.language}>
            <Select id="s-language" options={LANGUAGES} labels={o.languages} value={form.language} onChange={(e) => set('language', e.target.value as TextForm['language'])} />
          </Field>
          <Field id="s-length" label={s.length}>
            <Select id="s-length" options={LENGTHS} labels={o.lengths} value={form.length} onChange={(e) => set('length', e.target.value as TextForm['length'])} />
          </Field>
        </div>
        {!!error && <Alert {...msg(error)} />}
        {usage && !usage.aiEnabled && <Alert tone="warning" {...t.app.common.aiDisabled} />}
        {usage && usage.aiEnabled && usage.text.remaining === 0 && <Alert tone="warning" {...t.app.common.quota} />}
        {usage && usage.aiEnabled && usage.text.remaining > 0 && !usage.systemCapacity.text && <Alert tone="warning" {...t.app.common.systemQuota} />}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary btn-lg" disabled={busy || !!blocked}>
            {busy ? <Spinner /> : <Icon name="sparkles" className="h-4 w-4" />}
            {busy ? s.generating : s.generate}
          </button>
          <QuotaLine remaining={usage?.text.remaining} />
        </div>
      </form>

      <section ref={resultsRef} className="card scroll-mt-20 p-5 sm:p-6" aria-labelledby="studio-results" aria-busy={busy}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 id="studio-results" className="text-base font-bold">
            {s.results}
          </h2>
          {latest && project && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => generate()} disabled={busy || !!blocked}>
                <Icon name="sparkles" className="h-3.5 w-3.5" />
                {s.regenerate}
              </button>
              <button type="button" className="btn-primary !px-3 !py-1.5 text-xs" onClick={save} disabled={saving}>
                {saving ? t.app.common.saving : t.app.common.save}
              </button>
              <Link to={`/app/projects/${project.id}`} className="btn-ghost !px-3 !py-1.5 text-xs">
                {s.openProject}
              </Link>
            </div>
          )}
        </div>
        {busy ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted" role="status">
            <Spinner className="h-6 w-6 text-brand" />
            <p className="font-semibold text-fg">{t.app.common.generating.title}</p>
            <p className="text-sm">{t.app.common.generating.body}</p>
          </div>
        ) : latest ? (
          <TextVariants variants={latest.variants} onChange={updateLatest} />
        ) : (
          <p className="py-16 text-center text-sm text-muted">{s.emptyResults}</p>
        )}
      </section>
    </div>
  )
}

type ImgResult = { projectId: string; generationId: string; blob: Blob; url: string; width: number; height: number }

function ImageStudio({ usage, onUsed }: { usage: Usage | null; onUsed: () => void }) {
  const { t } = useI18n()
  const im = t.app.image
  const o = t.app.options
  const { toast } = useApp()
  const msg = useErrorMessage()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'text' | 'photo'>('text')
  const [description, setDescription] = useState(params.get('desc')?.slice(0, 500) ?? '')
  const [scene, setScene] = useState<Scene>('minimal_studio')
  const [style, setStyle] = useState<Style>('photorealistic')
  const [aspect, setAspect] = useState<Aspect>('1:1')
  const [reference, setReference] = useState<string | null>(null)
  const [fileError, setFileError] = useState<{ title: string; body: string } | null>(null)
  const [descError, setDescError] = useState(false)
  const [storeLocal, setStoreLocal] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [result, setResult] = useState<ImgResult | null>(null)
  const [gallery, setGallery] = useState<LocalImage[]>([])
  const maxMb = usage?.maxUploadMb ?? 5

  const refreshGallery = () => listLocalImages().then(setGallery).catch(() => setGallery([]))
  useEffect(() => {
    refreshGallery()
  }, [])
  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url)
  }, [result])

  const onFile = async (file: File | undefined) => {
    setFileError(null)
    setReference(null)
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) return setFileError(t.app.common.fileType)
    if (file.size > maxMb * 1024 * 1024) return setFileError(t.app.common.fileTooLarge)
    try {
      setReference(await toReferenceJpeg(file, 511))
    } catch {
      setFileError({ title: t.app.common.fileType.title, body: im.fieldErrors.referenceImage })
    }
  }

  const generate = async (e?: FormEvent) => {
    e?.preventDefault()
    if (description.trim().length < 3) {
      setDescError(true)
      document.getElementById('i-desc')?.focus()
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await post<{ projectId: string; generationId: string; image: { base64: string; mime: string }; width: number; height: number }>(
        '/api/ai/generate-image',
        { description, scene, style, aspect, referenceImage: mode === 'photo' ? reference : null },
        { 'Idempotency-Key': newIdempotencyKey() },
      )
      const blob = base64ToBlob(r.image.base64, r.image.mime)
      setResult({ projectId: r.projectId, generationId: r.generationId, blob, url: URL.createObjectURL(blob), width: r.width, height: r.height })
      if (storeLocal) {
        await saveLocalImage({ id: r.generationId, projectId: r.projectId, blob, width: r.width, height: r.height, prompt: description, createdAt: new Date().toISOString() }).catch(() => {})
        refreshGallery()
      }
      toast({ tone: 'success', ...t.app.common.ready })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
      onUsed()
    }
  }

  const blocked = usage && (!usage.aiEnabled || usage.image.remaining === 0 || !usage.systemCapacity.image)
  const choice = (active: boolean) => `rounded-xl border px-3 py-2 text-sm font-medium ${active ? 'border-brand bg-brand-soft text-brand-fg' : 'border-line hover:bg-surface-2'}`
  const preview = useMemo(() => reference, [reference])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <form noValidate onSubmit={generate} className="card space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-base font-bold">{im.title}</h2>
          <p className="mt-1 text-sm text-muted">{im.lead}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
          <button type="button" role="radio" aria-checked={mode === 'text'} className={choice(mode === 'text')} onClick={() => setMode('text')}>
            {im.modeText}
          </button>
          <button type="button" role="radio" aria-checked={mode === 'photo'} className={choice(mode === 'photo')} onClick={() => setMode('photo')}>
            {im.modePhoto}
          </button>
        </div>
        {mode === 'photo' && (
          <Field id="i-file" label={im.upload} hint={fill(im.uploadHint, { mb: String(maxMb) })}>
            <input
              id="i-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-fg"
            />
            {fileError && (
              <div className="mt-2">
                <Alert {...fileError} />
              </div>
            )}
            {preview && (
              <div className="mt-3 flex items-center gap-3">
                <img src={preview} alt={im.upload} className="h-20 w-20 rounded-lg border border-line object-cover" />
                <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setReference(null)}>
                  {im.remove}
                </button>
              </div>
            )}
          </Field>
        )}
        <Field id="i-desc" label={im.description} error={descError ? im.fieldErrors.description : undefined}>
          <TextArea
            id="i-desc"
            rows={3}
            maxLength={500}
            value={description}
            placeholder={im.descriptionPh}
            error={descError ? im.fieldErrors.description : undefined}
            onChange={(e) => {
              setDescription(e.target.value)
              setDescError(false)
            }}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="i-scene" label={im.scene}>
            <Select id="i-scene" options={SCENES} labels={o.scenes} value={scene} onChange={(e) => setScene(e.target.value as Scene)} />
          </Field>
          <Field id="i-style" label={im.style}>
            <Select id="i-style" options={STYLES} labels={o.styles} value={style} onChange={(e) => setStyle(e.target.value as Style)} />
          </Field>
          <Field id="i-aspect" label={im.aspect}>
            <Select id="i-aspect" options={ASPECTS} labels={Object.fromEntries(ASPECTS.map((a) => [a, a])) as Record<Aspect, string>} value={aspect} onChange={(e) => setAspect(e.target.value as Aspect)} />
          </Field>
        </div>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" checked={storeLocal} onChange={(e) => setStoreLocal(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
          <span>
            {im.storeLocal}
            <span className="block text-xs text-muted">{im.localWarning}</span>
          </span>
        </label>
        {!!error && <Alert {...msg(error)} />}
        {usage && !usage.aiEnabled && <Alert tone="warning" {...t.app.common.aiDisabled} />}
        {usage && usage.aiEnabled && usage.image.remaining === 0 && <Alert tone="warning" {...t.app.common.quota} />}
        {usage && usage.aiEnabled && usage.image.remaining > 0 && !usage.systemCapacity.image && <Alert tone="warning" {...t.app.common.systemQuota} />}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary btn-lg" disabled={busy || !!blocked || (mode === 'photo' && !reference)}>
            {busy ? <Spinner /> : <Icon name="image" className="h-4 w-4" />}
            {busy ? im.generating : im.generate}
          </button>
          <QuotaLine remaining={usage?.image.remaining} />
        </div>
      </form>

      <section className="card p-5 sm:p-6" aria-busy={busy}>
        {busy ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted" role="status">
            <Spinner className="h-6 w-6 text-brand" />
            <p className="font-semibold text-fg">{im.generating}</p>
          </div>
        ) : result ? (
          <div>
            <img src={result.url} alt={description} width={result.width} height={result.height} className="h-auto w-full rounded-xl border border-line" />
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => downloadAs(result.blob, 'png', `pixo-${result.generationId.slice(0, 8)}`)}>
                <Icon name="download" className="h-3.5 w-3.5" />
                {im.downloadPng}
              </button>
              <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => downloadAs(result.blob, 'jpg', `pixo-${result.generationId.slice(0, 8)}`)}>
                <Icon name="download" className="h-3.5 w-3.5" />
                {im.downloadJpg}
              </button>
              <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => generate()} disabled={!!blocked}>
                {im.retry}
              </button>
              <Link to={`/app/projects/${result.projectId}`} className="btn-ghost !px-3 !py-1.5 text-xs">
                {t.app.studio.openProject}
              </Link>
            </div>
            <p className="mt-3 text-xs text-muted">{im.disclaimer}</p>
          </div>
        ) : (
          <p className="py-24 text-center text-sm text-muted">{im.disclaimer}</p>
        )}
        <LocalGallery images={gallery} onChange={refreshGallery} />
      </section>
    </div>
  )
}

export function LocalGallery({ images, onChange }: { images: LocalImage[]; onChange: () => void }) {
  const { t } = useI18n()
  const im = t.app.image
  const urls = useMemo(() => images.map((i) => URL.createObjectURL(i.blob)), [images])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  return (
    <div className="mt-8 border-t border-line pt-5">
      <h3 className="text-sm font-bold">{im.gallery}</h3>
      <p className="mt-1 text-xs text-muted">{im.localWarning}</p>
      {images.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{im.galleryEmpty}</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img, i) => (
            <li key={img.id} className="group overflow-hidden rounded-xl border border-line bg-bg">
              <img src={urls[i]} alt={img.prompt} className="aspect-square w-full object-cover" loading="lazy" />
              <div className="flex flex-wrap gap-1 p-2">
                <button type="button" className="rounded-md px-1.5 py-1 text-[11px] font-semibold text-brand-fg hover:bg-brand-soft" onClick={() => downloadAs(img.blob, 'png', `pixo-${img.id.slice(0, 8)}`)}>
                  PNG
                </button>
                <button type="button" className="rounded-md px-1.5 py-1 text-[11px] font-semibold text-brand-fg hover:bg-brand-soft" onClick={() => downloadAs(img.blob, 'jpg', `pixo-${img.id.slice(0, 8)}`)}>
                  JPG
                </button>
                <button
                  type="button"
                  className="ml-auto rounded-md px-1.5 py-1 text-[11px] font-semibold text-danger hover:bg-danger/10"
                  onClick={() => deleteLocalImage(img.id).then(onChange)}
                  aria-label={im.deleteLocal}
                >
                  <Icon name="x" className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
