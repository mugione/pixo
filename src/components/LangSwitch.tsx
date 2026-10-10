import { Link, useLocation } from 'react-router'
import { useI18n } from '../i18n'
import { LANGS, localePath, splitLang } from '../i18n/routes'
import { STORAGE_KEYS } from '../lib/site'

export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, t } = useI18n()
  const { pathname, search } = useLocation()
  const { path } = splitLang(pathname)
  const remember = (l: string) => {
    try {
      localStorage.setItem(STORAGE_KEYS.lang, l)
    } catch {
      /* ignore */
    }
  }
  return (
    <div role="group" aria-label={t.common.langSwitch.label} className={`inline-flex rounded-xl border border-line p-0.5 ${className}`}>
      {LANGS.map((l) => (
        <Link
          key={l}
          to={localePath(l, path) + search}
          hrefLang={l}
          lang={l}
          onClick={() => remember(l)}
          aria-current={l === lang ? 'true' : undefined}
          title={l === lang ? undefined : t.common.langSwitch.switchTo}
          className={`rounded-[10px] px-2.5 py-1 text-xs font-semibold uppercase transition-colors ${
            l === lang ? 'bg-brand-soft text-brand-fg' : 'text-muted hover:text-fg'
          }`}
        >
          {l}
        </Link>
      ))}
    </div>
  )
}
