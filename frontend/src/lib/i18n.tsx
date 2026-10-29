import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { en, type MessageKey } from '../locales/en'
import { kn } from '../locales/kn'
import { mr } from '../locales/mr'
import { te } from '../locales/te'

/** The language of the website itself; a book's own language is separate. */
export type UiLanguage = 'en' | 'te' | 'kn' | 'mr'

export const UI_LANGUAGES: { code: UiLanguage; label: string; name: string }[] = [
  { code: 'kn', label: 'ಕ', name: 'ಕನ್ನಡ' },
  { code: 'te', label: 'తె', name: 'తెలుగు' },
  { code: 'mr', label: 'म', name: 'मराठी' },
  { code: 'en', label: 'EN', name: 'English' },
]

// Translations may lag behind English; a missing phrase shows in English rather than as a key.
const MESSAGES: Record<UiLanguage, Partial<Record<MessageKey, string>>> = { en, te, kn, mr }

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

export function translate(language: UiLanguage, key: MessageKey, vars?: Record<string, string | number>): string {
  const text = MESSAGES[language][key] ?? en[key]
  return vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text
}

function startingLanguage(): UiLanguage {
  try {
    const saved = localStorage.getItem('ui-language')
    if (saved && saved in MESSAGES) return saved as UiLanguage
  } catch {
    // Storage blocked: fall through to the browser's languages.
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const code = tag.slice(0, 2).toLowerCase()
    if (code === 'te' || code === 'kn' || code === 'mr') return code
  }
  return 'en'
}

interface I18n {
  language: UiLanguage
  setLanguage: (language: UiLanguage) => void
  t: Translate
}

const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<UiLanguage>(startingLanguage)

  useEffect(() => {
    // Screen readers and the Indic line-height rules follow <html lang>.
    document.documentElement.lang = language
    try {
      localStorage.setItem('ui-language', language)
    } catch {
      // Private browsing: the choice just isn't remembered.
    }
  }, [language])

  const t = useCallback<Translate>((key, vars) => translate(language, key, vars), [language])
  const value = useMemo(() => ({ language, setLanguage, t }), [language, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const i18n = useContext(I18nContext)
  if (!i18n) throw new Error('useI18n needs an I18nProvider')
  return i18n
}

export const useT = () => useI18n().t
