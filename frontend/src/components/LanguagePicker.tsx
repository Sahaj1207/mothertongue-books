import { useEffect, useRef, useState } from 'react'
import { UI_LANGUAGES, useI18n } from '../lib/i18n'

/** Switches the website's own language: ಕ / తె / म / EN. */
export function LanguagePicker() {
  const { language, setLanguage, t } = useI18n()
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const current = UI_LANGUAGES.find((l) => l.code === language)!

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menu.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div ref={menu} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`${t('nav.websiteLanguage')}: ${current.name}`}
        className="flex h-11 min-w-11 items-center justify-center rounded-full px-2 text-base font-semibold text-ink-soft hover:text-ink"
      >
        {current.label}
      </button>
      {open && (
        <div
          role="group"
          aria-label={t('nav.websiteLanguage')}
          className="fixed inset-x-3 top-[4.25rem] z-30 rounded-2xl sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-48 border border-rule bg-sheet p-2 shadow-lg"
        >
          {UI_LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              lang={l.code}
              aria-pressed={language === l.code}
              onClick={() => {
                setLanguage(l.code)
                setOpen(false)
              }}
              className={`flex h-11 w-full items-center justify-between rounded-xl px-3 text-left font-medium text-ink ${
                language === l.code ? 'bg-paper' : 'hover:bg-paper'
              }`}
            >
              {l.name}
              {language === l.code && (
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path d="M6 12.5l4 4L18 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
