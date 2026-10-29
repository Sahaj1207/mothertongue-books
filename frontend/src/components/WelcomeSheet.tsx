import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { UI_LANGUAGES, useI18n } from '../lib/i18n'
import { recalled, remember, THEMES, useTheme } from '../lib/theme'
import { ThemeSwatch } from './ThemeSwitcher'

/**
 * First visit only: the website language (most phones in India are set to English) and a look.
 * A sheet over the page rather than a gate, so the site is visible behind it; never shown again.
 */
export function WelcomeSheet() {
  const { pathname } = useLocation()
  const { language, setLanguage, t } = useI18n()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(() => recalled('welcomed') === null && pathname !== '/sign-in')
  const first = useRef<HTMLButtonElement>(null)

  function close() {
    remember('welcomed', '1')
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/35" onClick={close} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="welcome-sheet relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-sheet p-5 pb-6 shadow-2xl sm:rounded-3xl sm:p-7"
      >
        <button
          type="button"
          onClick={close}
          aria-label={t('common.close')}
          className="absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full text-xl text-ink-faint hover:text-ink"
        >
          ×
        </button>
        <h2 id="welcome-title" className="pr-10 font-[family-name:var(--font-display)] text-2xl font-semibold">
          {t('welcome.title')}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{t('welcome.sub')}</p>

        <p className="mt-5 text-sm font-semibold">{t('welcome.language')}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={t('welcome.language')}>
          {UI_LANGUAGES.map((l, i) => (
            <button
              key={l.code}
              ref={i === 0 ? first : undefined}
              type="button"
              lang={l.code}
              aria-pressed={language === l.code}
              onClick={() => setLanguage(l.code)}
              className={`h-12 rounded-2xl border-2 text-lg font-semibold transition-colors ${
                language === l.code ? 'border-ink bg-ink text-on-ink' : 'border-rule bg-sheet hover:border-ink-faint'
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>

        <p className="mt-5 text-sm font-semibold">{t('welcome.look')}</p>
        <div className="mt-2 grid grid-cols-5 gap-2" role="group" aria-label={t('welcome.look')}>
          {THEMES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={theme === option.id}
              onClick={() => setTheme(option.id)}
              className={`flex flex-col items-center gap-1 rounded-2xl p-1.5 text-xs leading-tight ${
                theme === option.id ? 'bg-paper ring-2 ring-ink' : 'hover:bg-paper'
              }`}
            >
              <ThemeSwatch swatch={option.swatch} />
              <span className="text-center">{t(`theme.${option.id}`)}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={close}
            className="h-12 flex-1 rounded-full bg-ink px-6 font-semibold text-on-ink hover:bg-ink-soft"
          >
            {t('welcome.start')}
          </button>
          <button type="button" onClick={close} className="h-12 px-4 font-medium text-ink-soft hover:text-ink">
            {t('welcome.skip')}
          </button>
        </div>
      </div>
    </div>
  )
}
