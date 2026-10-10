import { useState, type FormEvent } from 'react'
import { fill, useI18n } from '../../i18n'
import { del, post, put } from '../../lib/api'
import { downloadText } from '../../lib/imageTools'
import { isCancelled, registerPasskey } from '../../lib/passkey'
import { useApp } from '../AppContext'
import { PageLoader } from '../AppRoot'
import { useFetch } from '../hooks'
import { Alert, ConfirmDialog, CopyButton, Field, formatDate, PageHeader, TextInput, useErrorMessage } from '../ui'

type Passkeys = { passkeys: { id: string; name: string | null; createdAt: string; lastUsedAt: string | null }[]; remainingRecoveryCodes: number }

export function RecoveryCodes({ codes }: { codes: string[] }) {
  const { t } = useI18n()
  const a = t.app.auth
  const text = codes.join('\n')
  return (
    <div>
      <ul className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-bg p-4 font-mono text-sm" aria-label={a.codesTitle}>
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <CopyButton text={text} />
        <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => downloadText(`Pixo AI recovery codes\n\n${text}\n`, 'pixo-recovery-codes.txt')}>
          {a.download}
        </button>
      </div>
    </div>
  )
}

export default function Settings() {
  const { t, lang } = useI18n()
  const s = t.app.settings
  const { user, refresh, setLanguage, toast } = useApp()
  const msg = useErrorMessage()
  const pk = useFetch<Passkeys>('/api/auth/passkeys')
  const [profile, setProfile] = useState({ displayName: user.displayName, brandName: user.brandName ?? '', email: user.email ?? '' })
  const [profileErr, setProfileErr] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [newCodes, setNewCodes] = useState<string[] | null>(null)
  const [confirmCodes, setConfirmCodes] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [deleteText, setDeleteText] = useState('')
  const [pkError, setPkError] = useState<string | null>(null)

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setProfileErr([])
    try {
      await put('/api/user/profile', profile)
      await refresh()
      toast({ tone: 'success', ...t.app.common.saved })
    } catch (err) {
      const fields = (err as { fields?: string[] }).fields ?? []
      setProfileErr(fields)
      toast({ tone: 'danger', ...msg(err) })
    } finally {
      setSaving(false)
    }
  }

  const addPasskey = async () => {
    setPkError(null)
    try {
      await registerPasskey('/api/auth/passkeys/options', '/api/auth/passkeys/verify', {})
      toast({ tone: 'success', title: s.passkeyAdded })
      pk.reload()
    } catch (e) {
      setPkError(isCancelled(e) ? t.app.auth.cancelled : t.app.auth.failed)
    }
  }

  const regenerate = async () => {
    try {
      const r = await post<{ recoveryCodes: string[] }>('/api/auth/recovery-codes', {})
      setNewCodes(r.recoveryCodes)
      pk.reload()
    } catch (e) {
      toast({ tone: 'danger', ...msg(e) })
    }
  }

  const deleteAccount = async () => {
    try {
      await del('/api/user/account', { confirm: 'DELETE' })
      window.location.assign(lang === 'en' ? '/en' : '/')
    } catch (e) {
      toast({ tone: 'danger', ...msg(e) })
    }
  }

  return (
    <>
      <PageHeader title={s.title} />
      <div className="space-y-6">
        <form noValidate onSubmit={saveProfile} className="card space-y-4 p-5 sm:p-6">
          <h2 className="text-base font-bold">{s.profile}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="st-name" label={s.displayName} error={profileErr.includes('displayName') ? s.displayName : undefined}>
              <TextInput id="st-name" value={profile.displayName} maxLength={100} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} />
            </Field>
            <Field id="st-brand" label={s.brandName} optional>
              <TextInput id="st-brand" value={profile.brandName} maxLength={100} onChange={(e) => setProfile({ ...profile, brandName: e.target.value })} />
            </Field>
            <Field id="st-email" label={s.email} optional hint={profile.email && !user.emailVerified ? s.emailUnverified : undefined} error={profileErr.includes('email') ? t.contact.fieldErrors.email : undefined}>
              <TextInput id="st-email" type="email" value={profile.email} maxLength={254} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            </Field>
            <Field id="st-lang" label={s.language}>
              <select id="st-lang" className="input" value={user.language} onChange={(e) => setLanguage(e.target.value as 'tr' | 'en')}>
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
              </select>
            </Field>
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? t.app.common.saving : t.app.common.save}
          </button>
        </form>

        <section className="card space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">{s.passkeys}</h2>
              <p className="mt-1 text-sm text-muted">{s.passkeysLead}</p>
            </div>
            <button type="button" className="btn-secondary" onClick={addPasskey}>
              {s.addPasskey}
            </button>
          </div>
          {pkError && <Alert title={pkError} />}
          {pk.loading && !pk.data ? (
            <PageLoader />
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {pk.data?.passkeys.map((p, i) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {p.name || s.passkeyName} {i + 1}
                    </p>
                    <p className="text-xs text-muted">
                      {s.created}: {formatDate(p.createdAt, lang)}
                      {p.lastUsedAt && ` · ${s.lastUsed}: ${formatDate(p.lastUsedAt, lang)}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost !px-3 !py-1.5 text-xs text-danger"
                    disabled={(pk.data?.passkeys.length ?? 0) <= 1}
                    title={(pk.data?.passkeys.length ?? 0) <= 1 ? s.onlyOne : undefined}
                    onClick={() => setRemoveId(p.id)}
                  >
                    {t.app.common.delete}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">{s.recovery}</h2>
              {pk.data && <p className="mt-1 text-sm text-muted">{fill(s.recoveryLeft, { n: String(pk.data.remainingRecoveryCodes) })}</p>}
            </div>
            <button type="button" className="btn-secondary" onClick={() => setConfirmCodes(true)}>
              {s.regenerate}
            </button>
          </div>
          {newCodes && (
            <>
              <Alert tone="warning" title={t.app.auth.codesTitle} body={t.app.auth.codesLead} />
              <RecoveryCodes codes={newCodes} />
            </>
          )}
        </section>

        <section className="card space-y-4 border-danger/30 p-5 sm:p-6">
          <h2 className="text-base font-bold text-danger">{s.danger}</h2>
          <p className="text-sm text-muted">{s.dangerBody}</p>
          <Field id="st-delete" label={s.typeDelete}>
            <TextInput id="st-delete" value={deleteText} autoComplete="off" onChange={(e) => setDeleteText(e.target.value)} className="max-w-xs" />
          </Field>
          <button type="button" className="btn bg-danger text-white hover:bg-danger/90" disabled={deleteText !== 'DELETE'} onClick={deleteAccount}>
            {s.deleteAccount}
          </button>
        </section>
      </div>

      <ConfirmDialog
        open={confirmCodes}
        title={s.regenerate}
        body={s.regenerateConfirm}
        confirmLabel={s.regenerate}
        danger={false}
        onConfirm={regenerate}
        onClose={() => setConfirmCodes(false)}
      />
      <ConfirmDialog
        open={!!removeId}
        title={t.app.common.delete}
        body={s.passkeys}
        confirmLabel={t.app.common.delete}
        onConfirm={async () => {
          if (!removeId) return
          await del(`/api/auth/passkeys/${removeId}`).catch((e) => toast({ tone: 'danger', ...msg(e) }))
          pk.reload()
        }}
        onClose={() => setRemoveId(null)}
      />
    </>
  )
}
