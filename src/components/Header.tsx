import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { useI18n } from '../i18n'
import type { PageId } from '../i18n/routes'
import { Icon } from './Icon'
import { LangSwitch } from './LangSwitch'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

const NAV: { page: PageId; key: 'features' | 'howItWorks' | 'solutions' | 'pricing' | 'about' }[] = [
  { page: 'features', key: 'features' },
  { page: 'howItWorks', key: 'howItWorks' },
  { page: 'solutions', key: 'solutions' },
  { page: 'pricing', key: 'pricing' },
  { page: 'about', key: 'about' },
]

export function Header() {
  const { t, to } = useI18n()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'text-fg' : 'text-muted hover:text-fg'}`

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/70">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to={to('home')} className="shrink-0 rounded-lg" aria-label="Pixo AI">
          <Logo />
        </Link>

        <nav aria-label={t.common.nav.mainNav} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.page}>
                <NavLink to={to(n.page)} className={linkCls}>
                  {t.common.nav[n.key]}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <LangSwitch />
          <ThemeToggle />
          <Link to={to('login')} className="btn-ghost">
            {t.common.nav.login}
          </Link>
          <Link to={to('signup')} className="btn-primary">
            {t.common.nav.start}
          </Link>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="btn-ghost h-10 w-10 !p-0"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={open ? 'x' : 'menu'} className="h-6 w-6" />
            <span className="sr-only">{open ? t.common.nav.closeMenu : t.common.nav.openMenu}</span>
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-line bg-bg lg:hidden">
          <nav aria-label={t.common.nav.mainNav} className="container-page py-4">
            <ul className="flex flex-col">
              {NAV.map((n) => (
                <li key={n.page}>
                  <NavLink to={to(n.page)} className={({ isActive }) => `${linkCls({ isActive })} block !px-2 !py-3 text-base`}>
                    {t.common.nav[n.key]}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
              <LangSwitch />
              <div className="flex gap-2">
                <Link to={to('login')} className="btn-secondary">
                  {t.common.nav.login}
                </Link>
                <Link to={to('signup')} className="btn-primary">
                  {t.common.nav.start}
                </Link>
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
