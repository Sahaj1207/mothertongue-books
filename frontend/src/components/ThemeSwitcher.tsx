import { useEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n'

export type Theme = 'notebook' | 'clay' | 'pop' | 'kolam' | 'slate'

// Background, accent and text colours for each theme's little preview.
const THEMES: { id: Theme; swatch: [string, string, string] }[] = [
  { id: 'notebook', swatch: ['#ffffff', '#e0474c', '#1f2a44'] },
  { id: 'clay', swatch: ['#eef2ff', '#6f79f2', '#2d3266'] },
  { id: 'pop', swatch: ['#fff6d6', '#ff5c8a', '#111111'] },
  { id: 'kolam', swatch: ['#fbf1e3', '#9c3d2a', '#3a1d12'] },
  { id: 'slate', swatch: ['#2e3b36', '#f2d36b', '#ecebe4'] },
]

// Matches each theme's page colour, for the phone's address bar.
const BAR_COLOR: Record<Theme, string> = {
  notebook: '#F7F9FC',
  clay: '#EEF2FF',
  pop: '#FF5C8A',
  kolam: '#9C3D2A',
  slate: '#232C29',
}

const isTheme = (value: string | undefined): value is Theme => THEMES.some((t) => t.id === value)

function remember(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Private browsing: the choice just isn't remembered.
  }
}

export function ThemeSwitcher() {
  const root = document.documentElement
  const [theme, setTheme] = useState<Theme>(() => (isTheme(root.dataset.theme) ? root.dataset.theme : 'notebook'))
  const [warm, setWarm] = useState(() => root.dataset.warm !== undefined)
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const t = useT()

  useEffect(() => {
    if (theme === 'notebook') delete root.dataset.theme
    else root.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[theme])
    remember('theme', theme)
  }, [root, theme])

  useEffect(() => {
    if (warm) root.dataset.warm = ''
    else delete root.dataset.warm
    remember('warm-light', warm ? '1' : null)
  }, [root, warm])

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
          className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-rule bg-sheet p-2 shadow-lg"
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
              <span
                aria-hidden="true"
                className="relative flex h-10 w-12 shrink-0 items-end overflow-hidden rounded-lg p-1.5"
                style={{ background: option.swatch[0], boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.12)' }}
              >
                <span className="h-2 w-full rounded-full" style={{ background: option.swatch[1] }} />
                <span
                  className="absolute top-1.5 left-1.5 text-xs leading-none font-bold"
                  style={{ color: option.swatch[2] }}
                >
                  ಅ
                </span>
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-ink">{t(`theme.${option.id}`)}</span>
                <span className="block text-xs text-ink-faint">{t(`theme.${option.id}.hint`)}</span>
              </span>
              {theme === option.id && (
                <svg viewBox="0 0 24 24" className="ml-auto h-5 w-5 shrink-0 text-ink" aria-hidden="true">
                  <path d="M6 12.5l4 4L18 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          ))}
          <div className="mt-1 border-t border-rule px-3 pt-3 pb-1.5">
            <button
              type="button"
              role="switch"
              aria-checked={warm}
              onClick={() => setWarm((w) => !w)}
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
