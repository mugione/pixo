const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

type VerifyResult = { success: boolean; action?: string; hostname?: string; 'error-codes'?: string[] }

/** Server-side Turnstile verification (the client-side widget alone proves nothing). */
export async function verifyTurnstile(
  secret: string,
  token: string,
  ip: string | null,
  expectedAction: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!token) return false
  const form = new FormData()
  form.append('secret', secret)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)
  form.append('idempotency_key', crypto.randomUUID())
  try {
    const res = await fetchImpl(VERIFY_URL, { method: 'POST', body: form })
    if (!res.ok) return false
    const out = (await res.json()) as VerifyResult
    if (!out.success) return false
    // Test keys return an empty action; real keys echo the action set on the widget.
    if (out.action && out.action !== expectedAction) return false
    return true
  } catch {
    return false
  }
}
