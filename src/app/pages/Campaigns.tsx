import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { GOALS, LANGUAGES, TONES, type CampaignResult } from '../../../shared/options'
import { fill, useI18n } from '../../i18n'
import { Icon } from '../../components/Icon'
import { ApiError, newIdempotencyKey, post, put } from '../../lib/api'
import { useApp } from '../AppContext'
import { CampaignEditor, campaignText } from '../editors'
import { useBrands, useFetch, useUsage, type ProjectSummary } from '../hooks'
import { Alert, CopyButton, Field, PageHeader, Select, Spinner, TextArea, TextInput, useErrorMessage } from '../ui'
import { ProjectRow } from './Dashboard'

/** `extra` holds the rest of the project content (e.g. the original inputs) so saving never drops it. */
export function CampaignActions({ projectId, value, extra = {}, onSaved }: { projectId: string; value: CampaignResult; extra?: Record<string, unknown>; onSaved?: () => void }) {
  const { t } = useI18n()
  const c = t.app.campaigns
  const { toast } = useApp()
  const msg = useErrorMessage()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const save = async (status?: 'completed') => {
    setSaving(true)
    try {
      await put(`/api/projects/${projectId}`, { content: { ...extra, campaign: value }, ...(status ? { status } : {}) })
      toast({ tone: 'success', ...t.app.common.saved })
      onSaved?.()
    } catch (e) {
      toast({ tone: 'danger', ...msg(e) })
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-primary !px-3 !py-1.5 text-xs" disabled={saving} onClick={() => save()}>
        {saving ? t.app.common.saving : c.saveDraft}
      </button>
      <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" disabled={saving} onClick={() => save('completed')}>
        <Icon name="check" className="h-3.5 w-3.5" />
        {c.markCompleted}
      </button>
      <CopyButton text={campaignText(value, c.fields)} />
      <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => navigate(`/app/create?tab=image&desc=${encodeURIComponent(value.visualConcept.slice(0, 500))}`)}>
        <Icon name="image" className="h-3.5 w-3.5" />
        {c.makeImage}
      </button>
    </div>
  )
}

export default function Campaigns() {
  const { t, lang } = useI18n()
  const c = t.app.campaigns
  const o = t.app.options
  const { toast } = useApp()
  const msg = useErrorMessage()
  const brands = useBrands()
  const usage = useUsage()
  const list = useFetch<{ projects: ProjectSummary[] }>('/api/projects?type=campaign')
  const [form, setForm] = useState({
    name: '',
    brandId: '',
    product: '',
    audience: '',
    goal: 'product_launch',
    duration: '',
    language: lang as (typeof LANGUAGES)[number],
    tone: 'professional',
    highlights: '',
  })
  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [result, setResult] = useState<{ projectId: string; campaign: CampaignResult } | null>(null)

  useEffect(() => {
    const def = brands.data?.brands.find((b) => b.isDefault)
    if (def) setForm((f) => (f.brandId ? f : { ...f, brandId: def.id, audience: f.audience || def.targetAudience || '' }))
  }, [brands.data])

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setFieldErrors((e) => e.filter((x) => x !== k))
  }

  const generate = async (e: FormEvent) => {
    e.preventDefault()
    const errs: string[] = []
    if (form.name.trim().length < 2) errs.push('name')
    if (form.product.trim().length < 10) errs.push('product')
    if (form.audience.trim().length < 3) errs.push('audience')
    setFieldErrors(errs)
    if (errs.length) {
      document.getElementById(`c-${errs[0]}`)?.focus()
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await post<{ projectId: string; campaign: CampaignResult }>('/api/ai/generate-campaign', { ...form, brandId: form.brandId || null }, { 'Idempotency-Key': newIdempotencyKey() })
      setResult(r)
      toast({ tone: 'success', title: c.readyTitle })
      list.reload()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'validation_error') setFieldErrors(err.fields)
      setError(err)
    } finally {
      setBusy(false)
      usage.reload()
    }
  }

  const fe = (k: keyof typeof c.fieldErrors) => (fieldErrors.includes(k) ? c.fieldErrors[k] : undefined)
  const u = usage.data
  const blocked = u && (!u.aiEnabled || u.text.remaining === 0 || !u.systemCapacity.text)

  return (
    <>
      <PageHeader title={c.title} lead={c.lead} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <form noValidate onSubmit={generate} className="card space-y-4 p-5 sm:p-6">
          <h2 className="text-base font-bold">{c.newCampaign}</h2>
          <Field id="c-name" label={c.name} error={fe('name')}>
            <TextInput id="c-name" value={form.name} maxLength={150} error={fe('name')} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field id="c-brand" label={t.app.studio.brand}>
            <select id="c-brand" className="input" value={form.brandId} onChange={(e) => set('brandId', e.target.value)}>
              <option value="">{t.app.studio.noBrand}</option>
              {brands.data?.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="c-product" label={c.product} error={fe('product')}>
            <TextArea id="c-product" rows={4} maxLength={2000} value={form.product} placeholder={c.productPh} error={fe('product')} onChange={(e) => set('product', e.target.value)} />
          </Field>
          <Field id="c-audience" label={c.audience} error={fe('audience')}>
            <TextInput id="c-audience" value={form.audience} maxLength={300} error={fe('audience')} onChange={(e) => set('audience', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="c-goal" label={c.goal}>
              <Select id="c-goal" options={GOALS} labels={o.goals} value={form.goal} onChange={(e) => set('goal', e.target.value)} />
            </Field>
            <Field id="c-duration" label={c.duration} optional>
              <TextInput id="c-duration" value={form.duration} maxLength={60} placeholder={c.durationPh} onChange={(e) => set('duration', e.target.value)} />
            </Field>
            <Field id="c-language" label={c.language}>
              <Select id="c-language" options={LANGUAGES} labels={o.languages} value={form.language} onChange={(e) => set('language', e.target.value)} />
            </Field>
            <Field id="c-tone" label={c.tone}>
              <Select id="c-tone" options={TONES} labels={o.tones} value={form.tone} onChange={(e) => set('tone', e.target.value)} />
            </Field>
          </div>
          <Field id="c-highlights" label={c.highlights} optional>
            <TextArea id="c-highlights" rows={3} maxLength={1000} value={form.highlights} placeholder={c.highlightsPh} onChange={(e) => set('highlights', e.target.value)} />
          </Field>
          {!!error && <Alert {...msg(error)} />}
          {u && !u.aiEnabled && <Alert tone="warning" {...t.app.common.aiDisabled} />}
          {u && u.aiEnabled && u.text.remaining === 0 && <Alert tone="warning" {...t.app.common.quota} />}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary btn-lg" disabled={busy || !!blocked}>
              {busy ? <Spinner /> : <Icon name="megaphone" className="h-4 w-4" />}
              {busy ? c.generating : c.generate}
            </button>
            {u && <p className="text-xs text-muted">{fill(t.app.common.remainingToday, { n: String(u.text.remaining) })}</p>}
          </div>
        </form>

        <div className="space-y-6">
          {busy ? (
            <div className="card flex flex-col items-center justify-center gap-3 py-24 text-muted" role="status">
              <Spinner className="h-6 w-6 text-brand" />
              <p className="font-semibold text-fg">{t.app.common.generating.title}</p>
            </div>
          ) : result ? (
            <section className="card p-5 sm:p-6">
              <div className="mb-4 flex flex-col gap-3">
                <h2 className="text-lg font-bold">{c.readyTitle}</h2>
                <CampaignActions projectId={result.projectId} value={result.campaign} extra={{ input: { ...form, brandId: form.brandId || null } }} onSaved={list.reload} />
              </div>
              <CampaignEditor value={result.campaign} onChange={(campaign) => setResult({ ...result, campaign })} />
            </section>
          ) : null}
          <section>
            <h2 className="mb-3 text-base font-bold">{c.list}</h2>
            {list.data?.projects.length ? (
              <ul className="card divide-y divide-line overflow-hidden">
                {list.data.projects.map((p) => (
                  <ProjectRow key={p.id} p={p} />
                ))}
              </ul>
            ) : (
              <div className="card p-6 text-sm text-muted">
                {c.listEmpty}{' '}
                <Link to="/app/create" className="font-semibold text-brand-fg hover:underline">
                  {t.app.nav.studio}
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
