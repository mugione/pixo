import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { loadTurnstile } from './turnstile'

/**
 * Renders a Turnstile widget when the server has a site key configured.
 * state 'off' = not configured (server does not require it), 'failed' = configured but could not load.
 */
export function useTurnstile(action: string, lang: string) {
  const ref = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const [token, setToken] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'off' | 'failed'>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cfg = await api<{ turnstileSiteKey: string | null }>('/api/public-config')
        if (!cfg.turnstileSiteKey) return !cancelled && setState('off')
        const ts = await loadTurnstile()
        if (cancelled || !ref.current) return
        widget.current = ts.render(ref.current, {
          sitekey: cfg.turnstileSiteKey,
          action,
          language: lang,
          theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
          callback: (t: string) => setToken(t),
          'expired-callback': () => setToken(''),
          'error-callback': () => setToken(''),
        })
        setState('ready')
      } catch {
        if (!cancelled) setState('failed')
      }
    })()
    return () => {
      cancelled = true
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current)
      widget.current = null
    }
  }, [action, lang])

  const reset = () => {
    setToken('')
    if (widget.current && window.turnstile) window.turnstile.reset(widget.current)
  }
  return { ref, token, state, reset, required: state !== 'off' }
}
