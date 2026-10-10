export const nowIso = () => new Date().toISOString()
export const uuid = () => crypto.randomUUID()

/** UTC calendar day (quota boundary is 00:00 UTC). */
export const todayUtc = (d = new Date()) => d.toISOString().slice(0, 10)
export function nextUtcMidnight(d = new Date()): string {
  const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1))
  return n.toISOString()
}

export function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)))
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Human-friendly one-time recovery code, e.g. "K7QM-2XPA-9TRD" (no ambiguous characters). */
export function recoveryCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length])
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((c) => c.join('')).join('-')
}
export const normalizeRecoveryCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '')

export function str(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max)
}
export const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback?: T): T | undefined =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
