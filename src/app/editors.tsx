// Editable result views shared by AI Studio, Campaign Builder and Project detail.
import type { CampaignResult, TextVariant } from '../../shared/options'
import { fill, useI18n } from '../i18n'
import { CopyButton, TextArea, TextInput } from './ui'

export function variantText(v: TextVariant) {
  return [v.title, v.body, v.cta, v.hashtags.join(' ')].filter(Boolean).join('\n\n')
}

export function TextVariants({ variants, onChange }: { variants: TextVariant[]; onChange: (v: TextVariant[]) => void }) {
  const { t } = useI18n()
  const s = t.app.studio
  const set = (i: number, patch: Partial<TextVariant>) => onChange(variants.map((v, j) => (i === j ? { ...v, ...patch } : v)))
  return (
    <div className="space-y-4">
      {variants.map((v, i) => (
        <article key={i} className="rounded-xl border border-line bg-bg p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold tracking-wide text-brand-fg uppercase">{fill(s.variant, { n: String(i + 1) })}</span>
            <CopyButton text={variantText(v)} />
          </div>
          <label className="sr-only" htmlFor={`v${i}-title`}>
            Title
          </label>
          <TextInput id={`v${i}-title`} value={v.title} onChange={(e) => set(i, { title: e.target.value })} className="!font-semibold" />
          <label className="sr-only" htmlFor={`v${i}-body`}>
            Body
          </label>
          <TextArea id={`v${i}-body`} value={v.body} rows={6} onChange={(e) => set(i, { body: e.target.value })} className="mt-2 leading-relaxed" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`v${i}-cta`} className="text-xs font-semibold text-muted">
                {s.cta}
              </label>
              <TextInput id={`v${i}-cta`} value={v.cta} onChange={(e) => set(i, { cta: e.target.value })} className="mt-1" />
            </div>
            {(
              <div>
                <label htmlFor={`v${i}-tags`} className="text-xs font-semibold text-muted">
                  {s.hashtags}
                </label>
                <TextInput
                  id={`v${i}-tags`}
                  value={v.hashtags.join(' ')}
                  onChange={(e) => set(i, { hashtags: e.target.value.split(/\s+/).filter(Boolean) })}
                  className="mt-1 font-mono text-xs"
                />
              </div>
            )}
          </div>
        </article>
      ))}
      <p className="text-xs text-muted">{t.app.common.aiCheck}</p>
    </div>
  )
}

export function campaignText(c: CampaignResult, labels: Record<string, string>) {
  return [
    `${labels.name}: ${c.name}`,
    `${labels.mainMessage}: ${c.mainMessage}`,
    `${labels.headlines}:\n${c.headlines.map((h) => `- ${h}`).join('\n')}`,
    `${labels.socialCaptions}:\n${c.socialCaptions.map((h) => `- ${h}`).join('\n')}`,
    `${labels.shortDescription}: ${c.shortDescription}`,
    `${labels.cta}: ${c.cta}`,
    `${labels.visualConcept}: ${c.visualConcept}`,
    `${labels.schedule}:\n${c.schedule.map((r) => `- ${r.day} · ${r.channel}: ${r.content}`).join('\n')}`,
  ].join('\n\n')
}

export function CampaignEditor({ value, onChange }: { value: CampaignResult; onChange: (c: CampaignResult) => void }) {
  const { t } = useI18n()
  const f = t.app.campaigns.fields
  const set = (patch: Partial<CampaignResult>) => onChange({ ...value, ...patch })
  const listEditor = (key: 'headlines' | 'socialCaptions', rows: number) => (
    <div className="space-y-2">
      {value[key].map((h, i) => (
        <div key={i} className="flex gap-2">
          <label className="sr-only" htmlFor={`${key}-${i}`}>{`${f[key]} ${i + 1}`}</label>
          <TextArea
            id={`${key}-${i}`}
            rows={rows}
            value={h}
            onChange={(e) => set({ [key]: value[key].map((x, j) => (j === i ? e.target.value : x)) } as Partial<CampaignResult>)}
          />
          <CopyButton text={h} className="self-start" />
        </div>
      ))}
    </div>
  )
  const block = (label: string, children: React.ReactNode, copy?: string) => (
    <section className="rounded-xl border border-line bg-bg p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-brand-fg uppercase">{label}</h3>
        {copy && <CopyButton text={copy} />}
      </div>
      {children}
    </section>
  )
  return (
    <div className="space-y-3">
      {block(f.name, <TextInput aria-label={f.name} value={value.name} onChange={(e) => set({ name: e.target.value })} />, value.name)}
      {block(f.mainMessage, <TextArea aria-label={f.mainMessage} rows={3} value={value.mainMessage} onChange={(e) => set({ mainMessage: e.target.value })} />, value.mainMessage)}
      {block(f.headlines, listEditor('headlines', 1))}
      {block(f.socialCaptions, listEditor('socialCaptions', 4))}
      {block(f.shortDescription, <TextArea aria-label={f.shortDescription} rows={3} value={value.shortDescription} onChange={(e) => set({ shortDescription: e.target.value })} />, value.shortDescription)}
      {block(f.cta, <TextInput aria-label={f.cta} value={value.cta} onChange={(e) => set({ cta: e.target.value })} />, value.cta)}
      {block(f.visualConcept, <TextArea aria-label={f.visualConcept} rows={3} value={value.visualConcept} onChange={(e) => set({ visualConcept: e.target.value })} />, value.visualConcept)}
      {block(
        f.schedule,
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="pb-2 font-semibold">{f.day}</th>
                <th className="pb-2 font-semibold">{f.channel}</th>
                <th className="pb-2 font-semibold">{f.content}</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {value.schedule.map((r, i) => (
                <tr key={i}>
                  {(['day', 'channel', 'content'] as const).map((k) => (
                    <td key={k} className="py-1 pr-2">
                      <TextInput
                        aria-label={`${f[k]} ${i + 1}`}
                        value={r[k]}
                        onChange={(e) => set({ schedule: value.schedule.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })}
                        className="!py-1.5 text-xs"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )}
      <p className="text-xs text-muted">{t.app.common.aiCheck}</p>
    </div>
  )
}
