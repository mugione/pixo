import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useI18n } from '../../i18n'
import { post, put } from '../../lib/api'
import { useApp } from '../AppContext'
import { Alert, Field, TextInput, useErrorMessage } from '../ui'

const TONES = ['professional', 'friendly', 'energetic', 'luxury', 'minimalist'] as const
const WORK = ['product', 'social', 'ad', 'campaign'] as const
const WORK_TARGET: Record<(typeof WORK)[number], string> = {
  product: '/app/create?type=product_description',
  social: '/app/create?type=instagram_post',
  ad: '/app/create?type=ad_copy',
  campaign: '/app/campaigns',
}

export default function Welcome() {
  const { t } = useI18n()
  const w = t.app.welcome
  const { user, refresh } = useApp()
  const navigate = useNavigate()
  const msg = useErrorMessage()
  const [step, setStep] = useState(0)
  const [brand, setBrand] = useState({ name: user.brandName ?? '', industry: '', audience: '' })
  const [tone, setTone] = useState<(typeof TONES)[number]>('professional')
  const [work, setWork] = useState<(typeof WORK)[number]>('product')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const finish = async (skip = false) => {
    setBusy(true)
    setError(null)
    try {
      if (!skip && brand.name.trim()) {
        await post('/api/brands', {
          name: brand.name,
          industry: brand.industry,
          targetAudience: brand.audience,
          tone: t.app.options.onboardingTones[tone],
          language: user.language,
          isDefault: true,
        })
      }
      await put('/api/user/profile', { onboarded: true })
      await refresh()
      navigate(skip ? '/app' : WORK_TARGET[work], { replace: true })
    } catch (e) {
      setError(e)
      setBusy(false)
    }
  }

  const choice = (active: boolean) =>
    `rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${active ? 'border-brand bg-brand-soft text-brand-fg' : 'border-line hover:bg-surface-2'}`

  return (
    <div className="mx-auto max-w-xl">
      <ol className="mb-8 flex gap-1.5" aria-label="progress">
        {w.steps.map((s, i) => (
          <li key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand' : 'bg-line'}`} aria-current={i === step ? 'step' : undefined}>
            <span className="sr-only">{s}</span>
          </li>
        ))}
      </ol>
      <div className="card p-6 sm:p-8">
        {step === 0 && (
          <>
            <h1 className="text-2xl font-bold">{w.s1Title}</h1>
            <p className="mt-3 text-muted">{w.s1Body}</p>
          </>
        )}
        {step === 1 && (
          <>
            <h1 className="text-2xl font-bold">{w.s2Title}</h1>
            <div className="mt-6 space-y-4">
              <Field id="w-brand" label={w.brandName} optional>
                <TextInput id="w-brand" value={brand.name} maxLength={100} onChange={(e) => setBrand({ ...brand, name: e.target.value })} />
              </Field>
              <Field id="w-industry" label={w.industry} optional>
                <TextInput id="w-industry" value={brand.industry} maxLength={100} onChange={(e) => setBrand({ ...brand, industry: e.target.value })} />
              </Field>
              <Field id="w-audience" label={w.audience} optional>
                <TextInput id="w-audience" value={brand.audience} maxLength={300} onChange={(e) => setBrand({ ...brand, audience: e.target.value })} />
              </Field>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="text-2xl font-bold">{w.s3Title}</h1>
            <p className="mt-2 text-muted">{w.s3Body}</p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2" role="radiogroup">
              {TONES.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={tone === k} className={choice(tone === k)} onClick={() => setTone(k)}>
                  {t.app.options.onboardingTones[k]}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="text-2xl font-bold">{w.s4Title}</h1>
            <p className="mt-2 text-muted">{w.s4Body}</p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2" role="radiogroup">
              {WORK.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={work === k} className={choice(work === k)} onClick={() => setWork(k)}>
                  {w.firstWork[k]}
                </button>
              ))}
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <h1 className="text-2xl font-bold">{w.s5Title}</h1>
            <p className="mt-3 text-muted">{w.s5Body}</p>
          </>
        )}
        {!!error && (
          <div className="mt-6">
            <Alert {...msg(error)} />
          </div>
        )}
        <div className="mt-8 flex items-center justify-between gap-3">
          <div>
            {step > 0 ? (
              <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)} disabled={busy}>
                {t.app.common.back}
              </button>
            ) : (
              <button type="button" className="btn-ghost" onClick={() => finish(true)} disabled={busy}>
                {w.skip}
              </button>
            )}
          </div>
          {step < 4 ? (
            <button type="button" className="btn-primary" onClick={() => setStep(step + 1)}>
              {t.app.common.next}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => finish()} disabled={busy}>
              {w.start}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
