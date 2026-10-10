// Small form and feedback primitives for the signed-in app.
import { useEffect, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { useI18n } from '../i18n'
import { Icon } from '../components/Icon'
import { ApiError } from '../lib/api'

type FieldProps = { id: string; label: string; error?: string; hint?: string; optional?: boolean; children: ReactNode }

export function Field({ id, label, error, hint, optional, children }: FieldProps) {
  const { t } = useI18n()
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {optional && <span className="ml-1 font-normal text-muted">({t.app.common.optional})</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

const invalidCls = (error?: string) => (error ? '!border-danger' : '')

export function TextInput({ error, className = '', ...p }: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return <input {...p} aria-invalid={!!error || undefined} aria-describedby={error ? `${p.id}-error` : undefined} className={`input ${invalidCls(error)} ${className}`} />
}

export function TextArea({ error, className = '', ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return <textarea {...p} aria-invalid={!!error || undefined} aria-describedby={error ? `${p.id}-error` : undefined} className={`input ${invalidCls(error)} ${className}`} />
}

export function Select<T extends string>({
  options,
  labels,
  placeholder,
  error,
  className = '',
  ...p
}: SelectHTMLAttributes<HTMLSelectElement> & { options: readonly T[]; labels: Record<T, string>; placeholder?: string; error?: string }) {
  return (
    <select {...p} aria-invalid={!!error || undefined} aria-describedby={error ? `${p.id}-error` : undefined} className={`input ${invalidCls(error)} ${className}`}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {labels[o]}
        </option>
      ))}
    </select>
  )
}

export function PageHeader({ title, lead, actions }: { title: string; lead?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {lead && <p className="mt-2 text-muted">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Alert({ tone = 'danger', title, body, children }: { tone?: 'danger' | 'warning' | 'success' | 'info'; title: string; body?: string; children?: ReactNode }) {
  const cls = {
    danger: 'border-danger/30 bg-danger/10',
    warning: 'border-warning/40 bg-warning/10',
    success: 'border-success/30 bg-success/10',
    info: 'border-brand/30 bg-brand-soft',
  }[tone]
  const titleCls = { danger: 'text-danger', warning: 'text-[#b45309] dark:text-warning', success: 'text-[#047857] dark:text-success', info: 'text-brand-fg' }[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>
      <p className={`font-semibold ${titleCls}`}>{title}</p>
      {body && <p className="mt-0.5 text-fg">{body}</p>}
      {children}
    </div>
  )
}

/** Maps any thrown error to the user-facing message pair from the spec (§19, §33). */
export function useErrorMessage() {
  const { t } = useI18n()
  const c = t.app.common
  return (e: unknown): { title: string; body: string } => {
    if (!(e instanceof ApiError)) return t.errors.generic
    switch (e.code) {
      case 'quota_exceeded':
        return c.quota
      case 'system_quota_exceeded':
        return c.systemQuota
      case 'ai_disabled':
      case 'unavailable':
        return c.aiDisabled
      case 'ai_failed':
        return c.aiFailed
      case 'unauthorized':
        return c.sessionExpired
      case 'network_error':
        return t.errors.network
      case 'rate_limited':
        return e.message.includes('AI request') ? c.busy : t.errors.rateLimited
      case 'validation_error':
        return t.errors.validation
      case 'captcha_failed':
        return t.errors.captcha
      default:
        return t.errors.generic
    }
  }
}

export function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const { t } = useI18n()
  const ref = useRef<HTMLSpanElement>(null)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      if (ref.current) {
        ref.current.textContent = t.app.common.copied
        setTimeout(() => ref.current && (ref.current.textContent = t.app.common.copy), 1600)
      }
    } catch {
      /* clipboard blocked: text stays selectable */
    }
  }
  return (
    <button type="button" onClick={copy} className={`btn-secondary !px-3 !py-1.5 text-xs ${className}`}>
      <Icon name="copy" className="h-3.5 w-3.5" />
      <span ref={ref} aria-live="polite">
        {t.app.common.copy}
      </span>
    </button>
  )
}

/** Accessible confirmation dialog built on <dialog>. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger = true,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-line bg-surface p-0 text-fg shadow-[var(--shadow-lift)] backdrop:bg-black/40"
    >
      <div className="p-6">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm text-muted">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t.app.common.cancel}
          </button>
          <button
            type="button"
            className={danger ? 'btn bg-danger text-white hover:bg-danger/90' : 'btn-primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function formatDate(iso: string | null | undefined, lang: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}
