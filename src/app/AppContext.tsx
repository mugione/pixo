import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { Lang } from '../i18n/routes'
import { api, post, put } from '../lib/api'
import { STORAGE_KEYS } from '../lib/site'

export type User = {
  id: string
  displayName: string
  brandName: string | null
  email: string | null
  emailVerified: boolean
  purpose: string | null
  role: 'user' | 'admin'
  language: Lang
  onboarded: boolean
  createdAt: string
}

type Toast = { id: number; title: string; body?: string; tone: 'success' | 'danger' }

type AppCtx = {
  user: User
  setUser: (u: User) => void
  refresh: () => Promise<void>
  setLanguage: (l: Lang) => Promise<void>
  logout: () => Promise<void>
  toast: (t: Omit<Toast, 'id'>) => void
}

const Ctx = createContext<AppCtx | null>(null)

export function AppProvider({ initial, children }: { initial: User; children: (toasts: Toast[]) => ReactNode }) {
  const [user, setUser] = useState(initial)
  const [toasts, setToasts] = useState<Toast[]>([])

  const refresh = useCallback(async () => {
    const r = await api<{ user: User }>('/api/auth/me')
    setUser(r.user)
  }, [])

  const setLanguage = useCallback(async (language: Lang) => {
    setUser((u) => ({ ...u, language }))
    try {
      localStorage.setItem(STORAGE_KEYS.lang, language)
    } catch {
      /* ignore */
    }
    await put('/api/user/profile', { language }).catch(() => {})
  }, [])

  const logout = useCallback(async () => {
    await post('/api/auth/logout', {}).catch(() => {})
    window.location.assign(user.language === 'en' ? '/en' : '/')
  }, [user.language])

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((ts) => [...ts, { ...t, id }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4000)
  }, [])

  return <Ctx.Provider value={{ user, setUser, refresh, setLanguage, logout, toast }}>{children(toasts)}</Ctx.Provider>
}

export function useApp(): AppCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApp outside AppProvider')
  return c
}
