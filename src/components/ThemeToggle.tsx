import { useI18n } from '../i18n'
import { STORAGE_KEYS } from '../lib/site'
import { Icon } from './Icon'

/** The icon/label are driven by CSS (`dark:`), so server and client markup always match. */
export function ThemeToggle() {
  const { t } = useI18n()
  const toggle = () => {
    const root = document.documentElement
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark'
    root.dataset.theme = next
    try {
      localStorage.setItem(STORAGE_KEYS.theme, next)
    } catch {
      /* storage may be unavailable (private mode); the toggle still works for this page view */
    }
  }
  return (
    <button type="button" onClick={toggle} className="btn-ghost h-10 w-10 !p-0" title={t.common.theme.toDark}>
      <Icon name="moon" className="h-5 w-5 dark:hidden" />
      <Icon name="sun" className="hidden h-5 w-5 dark:block" />
      <span className="sr-only dark:hidden">{t.common.theme.toDark}</span>
      <span className="sr-only hidden dark:inline">{t.common.theme.toLight}</span>
    </button>
  )
}
