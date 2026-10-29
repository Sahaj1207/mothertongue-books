import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type Theme = 'notebook' | 'clay' | 'pop' | 'kolam' | 'slate'

// Background, accent and text colours for each theme's little preview.
export const THEMES: { id: Theme; swatch: [string, string, string] }[] = [
  { id: 'notebook', swatch: ['#ffffff', '#e0474c', '#1f2a44'] },
  { id: 'clay', swatch: ['#eef2ff', '#4f58d6', '#2d3266'] },
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

/** localStorage that quietly does nothing in private browsing, where the choice just isn't remembered. */
export function remember(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage blocked.
  }
}

export function recalled(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  warm: boolean
  setWarm: (warm: boolean) => void
}

const ThemeContext = createContext<ThemeState | null>(null)

/** index.html applies the saved theme before the first paint; this keeps <html> in step afterwards. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const root = document.documentElement
  const [theme, setTheme] = useState<Theme>(() => (isTheme(root.dataset.theme) ? root.dataset.theme : 'notebook'))
  const [warm, setWarm] = useState(() => root.dataset.warm !== undefined)

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

  const value = useMemo(() => ({ theme, setTheme, warm, setWarm }), [theme, warm])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeState {
  const state = useContext(ThemeContext)
  if (!state) throw new Error('useTheme needs a ThemeProvider')
  return state
}
