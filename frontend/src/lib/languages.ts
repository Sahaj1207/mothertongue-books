export type LanguageCode = 'te' | 'kn' | 'mr'

export interface Language {
  code: LanguageCode
  /** English name, for adults using the interface. */
  name: string
  /** The language's name in its own script. */
  nativeName: string
  /** First letter of the script, used as the cover mark. */
  letter: string
  /** Regional handloom the language colour is drawn from. */
  weave: string
  color: string
  softColor: string
  storyFont: string
}

export const LANGUAGES: Record<LanguageCode, Language> = {
  te: {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    letter: 'అ',
    weave: 'Kalamkari indigo',
    color: 'var(--color-telugu)',
    softColor: 'var(--color-telugu-soft)',
    storyFont: 'var(--font-story-te)',
  },
  kn: {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    letter: 'ಅ',
    weave: 'Ilkal green',
    color: 'var(--color-kannada)',
    softColor: 'var(--color-kannada-soft)',
    storyFont: 'var(--font-story-kn)',
  },
  mr: {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    letter: 'अ',
    weave: 'Paithani magenta',
    color: 'var(--color-marathi)',
    softColor: 'var(--color-marathi-soft)',
    storyFont: 'var(--font-story-mr)',
  },
}

export const LANGUAGE_ORDER: LanguageCode[] = ['te', 'kn', 'mr']

export const READING_LEVELS = [
  { id: 1, label: 'First words', ages: '3–5' },
  { id: 2, label: 'Short sentences', ages: '5–7' },
  { id: 3, label: 'Little stories', ages: '7–9' },
] as const

export type ReadingLevel = (typeof READING_LEVELS)[number]['id']
