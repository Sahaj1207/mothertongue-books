import { useEffect, useRef, useState } from 'react'

type Theme = 'paper' | 'warm' | 'night'

const THEMES: { id: Theme; name: string; hint: string; swatch: [string, string] }[] = [
  { id: 'paper', name: 'Paper', hint: 'Bright, for daytime', swatch: ['#ffffff', '#1f2a44'] },
  { id: 'warm', name: 'Warm', hint: 'Soft light, easy on the eyes', swatch: ['#fcf5e8', '#3a2e22'] },
  { id: 'night', name: 'Night', hint: 'Dark, for bedtime', swatch: ['#1e2027', '#ebe5d9'] },
]

// Matches each theme's paper colour, for the phone's address bar.
const BAR_COLOR: Record<Theme, string> = { paper: '#F7F9FC', warm: '#F5ECDC', night: '#15161B' }

function savedTheme(): Theme {
  const theme = document.documentElement.dataset.theme
  return theme === 'warm' || theme === 'night' ? theme : 'paper'
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>(savedTheme)
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'paper') delete root.dataset.theme
    else root.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[theme])
    try {
      localStorage.setItem('theme', theme)
    } catch {
      // Private browsing: the theme just isn't remembered.
    }
  }, [theme])

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
        aria-label="Reading theme"
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          {theme === 'night' ? (
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" />
          ) : (
            <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" fill={theme === 'warm' ? 'currentColor' : 'none'} />
              <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
            </g>
          )}
        </svg>
      </button>
      {open && (
        <div
          role="group"
          aria-label="Reading theme"
          className="absolute right-0 mt-2 w-64 rounded-2xl border border-rule bg-sheet p-2 shadow-lg"
        >
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={theme === t.id}
              onClick={() => {
                setTheme(t.id)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${
                theme === t.id ? 'bg-paper' : 'hover:bg-paper'
              }`}
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rule text-sm font-semibold"
                style={{ background: t.swatch[0], color: t.swatch[1] }}
              >
                ಅ
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-ink">{t.name}</span>
                <span className="block text-xs text-ink-faint">{t.hint}</span>
              </span>
              {theme === t.id && (
                <svg viewBox="0 0 24 24" className="ml-auto h-5 w-5 text-ink" aria-hidden="true">
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
