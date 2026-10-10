import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router'
import { I18nProvider, useI18n } from '../i18n'
import { Icon, type IconName } from '../components/Icon'
import { Logo, LogoMark } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { api, ApiError } from '../lib/api'
import { AppProvider, useApp, type User } from './AppContext'
import { Spinner } from './ui'
import Brand from './pages/Brand'
import Campaigns from './pages/Campaigns'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import ProjectDetail from './pages/ProjectDetail'
import Projects from './pages/Projects'
import Settings from './pages/Settings'
import Studio from './pages/Studio'
import Usage from './pages/Usage'
import Welcome from './pages/Welcome'

/** Entry for /app/*. Server and first client render show the same neutral loader (hydration-safe). */
export default function AppRoot() {
  const [user, setUser] = useState<User | null>(null)
  const location = useLocation()

  useEffect(() => {
    api<{ user: User }>('/api/auth/me')
      .then((r) => setUser(r.user))
      .catch((e) => {
        if (e instanceof ApiError && (e.code === 'unauthorized' || e.code === 'forbidden')) {
          window.location.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
        } else setUser(null)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
        <LogoMark size={40} className="animate-pulse" />
      </div>
    )
  }
  return (
    <AppProvider initial={user}>
      {(toasts) => <Shell toasts={toasts} />}
    </AppProvider>
  )
}

function Shell({ toasts }: { toasts: { id: number; title: string; body?: string; tone: 'success' | 'danger' }[] }) {
  const { user } = useApp()
  useEffect(() => {
    document.documentElement.lang = user.language
  }, [user.language])
  return (
    <I18nProvider lang={user.language}>
      <AppLayout />
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 text-sm shadow-[var(--shadow-lift)] ${
              t.tone === 'success' ? 'border-success/30 bg-surface' : 'border-danger/30 bg-surface'
            }`}
          >
            <p className={`font-semibold ${t.tone === 'success' ? 'text-[#047857] dark:text-success' : 'text-danger'}`}>{t.title}</p>
            {t.body && <p className="mt-0.5 text-muted">{t.body}</p>}
          </div>
        ))}
      </div>
    </I18nProvider>
  )
}

const NAV: { to: string; key: keyof ReturnType<typeof useI18n>['t']['app']['nav']; icon: IconName; end?: boolean }[] = [
  { to: '/app', key: 'overview', icon: 'layout', end: true },
  { to: '/app/create', key: 'studio', icon: 'sparkles' },
  { to: '/app/campaigns', key: 'campaigns', icon: 'megaphone' },
  { to: '/app/projects', key: 'projects', icon: 'folder' },
  { to: '/app/brand', key: 'brand', icon: 'palette' },
  { to: '/app/history', key: 'history', icon: 'clock' },
  { to: '/app/usage', key: 'usage', icon: 'target' },
  { to: '/app/settings', key: 'settings', icon: 'shield' },
]

function AppLayout() {
  const { t } = useI18n()
  const { user, setLanguage, logout } = useApp()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    document.title = `${t.app.nav.overview} | Pixo AI`
  }, [t])

  if (!user.onboarded && pathname !== '/app/welcome') return <Navigate to="/app/welcome" replace />

  const nav = (
    <nav aria-label={t.app.nav.menu}>
      <ul className="space-y-1">
        {NAV.map((n) => (
          <li key={n.to}>
            <NavLink
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-soft text-brand-fg' : 'text-muted hover:bg-surface-2 hover:text-fg'
                }`
              }
            >
              <Icon name={n.icon} className="h-[18px] w-[18px]" />
              {t.app.nav[n.key]}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )

  const footer = (
    <div className="space-y-3 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-2">
        <div role="group" aria-label={t.common.langSwitch.label} className="inline-flex rounded-xl border border-line p-0.5">
          {(['tr', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLanguage(l)}
              aria-pressed={user.language === l}
              className={`rounded-[10px] px-2.5 py-1 text-xs font-semibold uppercase ${user.language === l ? 'bg-brand-soft text-brand-fg' : 'text-muted hover:text-fg'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <ThemeToggle />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium" title={user.displayName}>
          {user.displayName}
        </span>
        <button type="button" onClick={logout} className="btn-ghost !px-2.5 !py-1.5 text-xs">
          {t.app.nav.logout}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh bg-bg-subtle lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-bg p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2 pt-1">
          <Logo />
          <span className="badge bg-brand-soft text-brand-fg">{t.app.nav.beta}</span>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {footer}
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button type="button" className="btn-ghost h-10 w-10 !p-0" aria-expanded={open} aria-controls="app-drawer" onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? 'x' : 'menu'} className="h-6 w-6" />
          <span className="sr-only">{open ? t.common.nav.closeMenu : t.common.nav.openMenu}</span>
        </button>
      </header>
      {open && (
        <div id="app-drawer" className="fixed inset-x-0 top-14 bottom-0 z-30 flex flex-col overflow-y-auto border-t border-line bg-bg p-4 lg:hidden">
          <div className="flex-1">{nav}</div>
          {footer}
        </div>
      )}

      <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="welcome" element={<Welcome />} />
          <Route path="create" element={<Studio />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="brand" element={<Brand />} />
          <Route path="history" element={<History />} />
          <Route path="usage" element={<Usage />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="flex justify-center py-16 text-muted">
      <Spinner className="h-6 w-6" />
    </div>
  )
}
