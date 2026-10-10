// Contact-form validation shared by the browser (instant feedback) and the Worker (authoritative).

export type ContactInput = {
  name: string
  email: string
  subject: string
  message: string
  consent: boolean
  turnstileToken: string
  lang: 'tr' | 'en'
}

export type ContactField = 'name' | 'email' | 'subject' | 'message' | 'consent'

export const CONTACT_LIMITS = {
  name: [2, 100],
  email: [5, 254],
  subject: [2, 150],
  message: [10, 5000],
} as const

// Pragmatic email check (RFC 5322 is not regex-friendly); the address is never auto-mailed.
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/

const len = (s: string, [min, max]: readonly [number, number]) => s.length >= min && s.length <= max

/** Strips control characters (except newlines/tabs in the message) and trims. */
export function clean(value: unknown, multiline = false): string {
  if (typeof value !== 'string') return ''
  const re = multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g
  return value.replace(re, '').trim()
}

export function validateContact(raw: unknown): { ok: true; value: ContactInput } | { ok: false; fields: ContactField[] } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const value: ContactInput = {
    name: clean(r.name),
    email: clean(r.email).toLowerCase(),
    subject: clean(r.subject),
    message: clean(r.message, true),
    consent: r.consent === true,
    turnstileToken: typeof r.turnstileToken === 'string' ? r.turnstileToken.slice(0, 2048) : '',
    lang: r.lang === 'en' ? 'en' : 'tr',
  }
  const fields: ContactField[] = []
  if (!len(value.name, CONTACT_LIMITS.name)) fields.push('name')
  if (!len(value.email, CONTACT_LIMITS.email) || !EMAIL_RE.test(value.email)) fields.push('email')
  if (!len(value.subject, CONTACT_LIMITS.subject)) fields.push('subject')
  if (!len(value.message, CONTACT_LIMITS.message)) fields.push('message')
  if (!value.consent) fields.push('consent')
  return fields.length ? { ok: false, fields } : { ok: true, value }
}
