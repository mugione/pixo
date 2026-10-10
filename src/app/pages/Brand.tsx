import { useState, type FormEvent } from 'react'
import { LANGUAGES } from '../../../shared/options'
import { useI18n } from '../../i18n'
import { del, post, put } from '../../lib/api'
import { useApp } from '../AppContext'
import { PageLoader } from '../AppRoot'
import { useBrands, type Brand as BrandT } from '../hooks'
import { Alert, ConfirmDialog, Field, PageHeader, Select, TextArea, TextInput, useErrorMessage } from '../ui'

type Form = Omit<BrandT, 'id' | 'isDefault'> & { isDefault: boolean }
const EMPTY: Form = {
  name: '',
  description: '',
  industry: '',
  targetAudience: '',
  primaryColor: '#635BFF',
  secondaryColor: '#111827',
  slogan: '',
  tone: '',
  language: 'tr',
  preferredPhrases: '',
  avoidedPhrases: '',
  isDefault: false,
}

export default function Brand() {
  const { t } = useI18n()
  const b = t.app.brand
  const f = b.fields
  const { toast } = useApp()
  const msg = useErrorMessage()
  const { data, error, loading, reload } = useBrands()
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (loading && !data) return <PageLoader />
  if (error || !data) return <Alert {...msg(error)} />

  const startEdit = (brand?: BrandT) => {
    setFieldErrors([])
    setEditing(brand ? { id: brand.id, form: { ...EMPTY, ...Object.fromEntries(Object.entries(brand).map(([k, v]) => [k, v ?? ''])) } as Form } : { id: null, form: { ...EMPTY } })
  }
  const setF = (k: keyof Form, v: string | boolean) => editing && setEditing({ ...editing, form: { ...editing.form, [k]: v } })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    if (!editing.form.name.trim()) {
      setFieldErrors(['name'])
      return
    }
    setSaving(true)
    try {
      if (editing.id) await put(`/api/brands/${editing.id}`, editing.form)
      else await post('/api/brands', editing.form)
      toast({ tone: 'success', ...t.app.common.saved })
      setEditing(null)
      reload()
    } catch (err) {
      toast({ tone: 'danger', ...msg(err) })
    } finally {
      setSaving(false)
    }
  }
  const makeDefault = async (brand: BrandT) => {
    await put(`/api/brands/${brand.id}`, { ...brand, isDefault: true }).catch((e) => toast({ tone: 'danger', ...msg(e) }))
    reload()
  }
  const remove = async (id: string) => {
    await del(`/api/brands/${id}`).catch((e) => toast({ tone: 'danger', ...msg(e) }))
    reload()
  }

  const text = (k: keyof Form, label: string, opts: { area?: boolean; ph?: string; max?: number } = {}) => (
    <Field id={`b-${k}`} label={label} optional={k !== 'name'} error={fieldErrors.includes(k) ? label : undefined}>
      {opts.area ? (
        <TextArea id={`b-${k}`} rows={3} maxLength={opts.max ?? 1000} placeholder={opts.ph} value={(editing!.form[k] as string) ?? ''} onChange={(e) => setF(k, e.target.value)} />
      ) : (
        <TextInput id={`b-${k}`} maxLength={opts.max ?? 150} placeholder={opts.ph} value={(editing!.form[k] as string) ?? ''} onChange={(e) => setF(k, e.target.value)} />
      )}
    </Field>
  )

  return (
    <>
      <PageHeader
        title={b.title}
        lead={b.lead}
        actions={
          !editing && (
            <button type="button" className="btn-primary" onClick={() => startEdit()}>
              {b.add}
            </button>
          )
        }
      />
      {editing ? (
        <form noValidate onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {text('name', f.name, { max: 100 })}
            {text('industry', f.industry, { max: 100 })}
          </div>
          {text('description', f.description, { area: true })}
          <div className="grid gap-4 sm:grid-cols-2">
            {text('targetAudience', f.targetAudience, { max: 300 })}
            {text('slogan', f.slogan)}
          </div>
          {text('tone', f.tone, { area: true, ph: f.tonePh, max: 300 })}
          <div className="grid gap-4 sm:grid-cols-3">
            {(['primaryColor', 'secondaryColor'] as const).map((k) => (
              <Field key={k} id={`b-${k}`} label={f[k]}>
                <div className="flex items-center gap-2">
                  <input type="color" id={`b-${k}`} value={editing.form[k] || '#000000'} onChange={(e) => setF(k, e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-surface" />
                  <span className="font-mono text-xs text-muted">{editing.form[k]}</span>
                </div>
              </Field>
            ))}
            <Field id="b-language" label={f.language}>
              <Select id="b-language" options={LANGUAGES} labels={t.app.options.languages} value={editing.form.language} onChange={(e) => setF('language', e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {text('preferredPhrases', f.preferredPhrases, { area: true, max: 500 })}
            {text('avoidedPhrases', f.avoidedPhrases, { area: true, max: 500 })}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.form.isDefault} onChange={(e) => setF('isDefault', e.target.checked)} className="h-4 w-4 accent-brand" />
            {b.makeDefault}
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t.app.common.saving : t.app.common.save}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
              {t.app.common.cancel}
            </button>
          </div>
        </form>
      ) : data.brands.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-muted">{b.empty}</p>
          <button type="button" className="btn-primary mt-6" onClick={() => startEdit()}>
            {b.add}
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.brands.map((brand) => (
            <li key={brand.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="h-6 w-6 rounded-md border border-line" style={{ background: brand.primaryColor ?? '#635BFF' }} />
                    <span className="h-6 w-6 rounded-md border border-line" style={{ background: brand.secondaryColor ?? '#111827' }} />
                  </span>
                  <h2 className="text-lg font-bold">{brand.name}</h2>
                </div>
                {brand.isDefault && <span className="badge bg-brand-soft text-brand-fg">{b.default}</span>}
              </div>
              {brand.description && <p className="mt-3 line-clamp-2 text-sm text-muted">{brand.description}</p>}
              {brand.tone && <p className="mt-2 text-xs text-muted">{f.tone}: {brand.tone}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => startEdit(brand)}>
                  {t.app.common.edit}
                </button>
                {!brand.isDefault && (
                  <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => makeDefault(brand)}>
                    {b.makeDefault}
                  </button>
                )}
                <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs text-danger" onClick={() => setConfirmId(brand.id)}>
                  {t.app.common.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!confirmId}
        title={t.app.common.deleteConfirm.title}
        body={b.deleteConfirm}
        confirmLabel={t.app.common.delete}
        onConfirm={() => confirmId && remove(confirmId)}
        onClose={() => setConfirmId(null)}
      />
    </>
  )
}
