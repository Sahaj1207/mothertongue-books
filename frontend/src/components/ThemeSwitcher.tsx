import { useEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n'
import { THEMES, useTheme } from '../lib/theme'

export function ThemeSwitcher() {
  const { theme, setTheme, warm, setWarm } = useTheme()
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const t = useT()

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
        aria-label={t('theme.label')}
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.6 0-.5-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.6-9-7.6z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="7.5" cy="11" r="1.4" fill="currentColor" />
          <circle cx="10.5" cy="7.5" r="1.4" fill="currentColor" />
          <circle cx="15" cy="7.8" r="1.4" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div
          role="group"
          aria-label={t('theme.label')}
          className="fixed inset-x-3 top-[4.25rem] z-30 rounded-2xl sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-72 border border-rule bg-sheet p-2 shadow-lg"
        >
          {THEMES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={theme === option.id}
              onClick={() => setTheme(option.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${
                theme === option.id ? 'bg-paper' : 'hover:bg-paper'
              }`}
            >
              <ThemeSwatch swatch={option.swatch} />
              <span className="min-w-0">
                <span className="block font-medium text-ink">{t(`theme.${option.id}`)}</span>
                <span className="block text-xs text-ink-faint">{t(`theme.${option.id}.hint`)}</span>
              </span>
              {theme === option.id && (
                <svg viewBox="0 0 24 24" className="ml-auto h-5 w-5 shrink-0 text-ink" aria-hidden="true">
                  <path
                    d="M6 12.5l4 4L18 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          ))}
          <div className="mt-1 border-t border-rule px-3 pt-3 pb-1.5">
            <button
              type="button"
              role="switch"
              aria-checked={warm}
              onClick={() => setWarm(!warm)}
              className="flex w-full items-center gap-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">{t('theme.warmLight')}</span>
                <span className="block text-xs text-ink-faint">{t('theme.warmLight.hint')}</span>
              </span>
              <span
                aria-hidden="true"
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${warm ? 'bg-turmeric' : 'bg-rule'}`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${
                    warm ? 'left-6' : 'left-1'
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** A tiny preview of a theme: its page, accent and text colours. */
export function ThemeSwatch({ swatch }: { swatch: [string, string, string] }) {
  return (
    <span
      aria-hidden="true"
      className="relative flex h-10 w-12 shrink-0 items-end overflow-hidden rounded-lg p-1.5"
      style={{ background: swatch[0], boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.12)' }}
    >
      <span className="h-2 w-full rounded-full" style={{ background: swatch[1] }} />
      <span className="absolute top-1.5 left-1.5 text-xs leading-none font-bold" style={{ color: swatch[2] }}>
        ಅ
      </span>
    </span>
  )
}
