import { createContext, useContext, type ReactNode } from 'react'
import { tr, type Dict } from './tr'
import { en } from './en'
import { pagePath, type Lang, type PageId } from './routes'

export const dictionaries: Record<Lang, Dict> = { tr, en }

type I18n = { lang: Lang; t: Dict; to: (page: PageId) => string }

const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value: I18n = { lang, t: dictionaries[lang], to: (page) => pagePath(lang, page) }
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

/** Replaces `{name}` placeholders. */
export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`)
}
