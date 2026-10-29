/**
 * Every language a book can be written in. Adding a language starts here and in backend/app/languages.py
 * (a backend test checks the two lists match); see "Adding a language" in the README.
 */

export type LanguageCode = 'te' | 'kn' | 'mr' | 'sw' | 'ne' | 'zu'

export interface Language {
  code: LanguageCode
  /** English name, for adults using the interface. */
  name: string
  /** The language's name in its own script. */
  nativeName: string
  /** First letter of the script, used as the cover mark. */
  letter: string
  /** Where the language colour is drawn from. */
  weave: string
  /** The one colour each language is given; pale and dark-theme versions are worked out from it. */
  hex: string
  /** Text colour, adjusted per theme (brighter on Slate). */
  color: string
  /** Pale background in the same colour. */
  softColor: string
  storyFont: string
  /** BCP 47 tag for the phone's text-to-speech voice. */
  speech: string
  /** False until native speakers have checked books in it; shown as "New". */
  reviewed: boolean
}

type Entry = Omit<Language, 'color' | 'softColor'>

// Themes set --lang-lighten (Slate brightens colours for its dark page) and --lang-tint (how strong pale
// backgrounds are); see index.css.
function colours(hex: string) {
  return {
    color: `color-mix(in oklab, ${hex} calc(100% - var(--lang-lighten)), white)`,
    softColor: `color-mix(in oklab, ${hex} var(--lang-tint), var(--color-sheet))`,
  }
}

const DEVANAGARI = "'Baloo 2', 'Noto Sans Devanagari', sans-serif"
const LATIN = "'Baloo 2', 'Noto Sans', sans-serif"

const ENTRIES: Entry[] = [
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    letter: 'అ',
    weave: 'Kalamkari indigo',
    hex: '#2e4a9e',
    storyFont: 'var(--font-story-te)',
    speech: 'te-IN',
    reviewed: true,
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    letter: 'ಅ',
    weave: 'Ilkal green',
    hex: '#1e7f5c',
    storyFont: 'var(--font-story-kn)',
    speech: 'kn-IN',
    reviewed: true,
  },
  {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    letter: 'अ',
    weave: 'Paithani magenta',
    hex: '#b4246a',
    storyFont: 'var(--font-story-mr)',
    speech: 'mr-IN',
    reviewed: true,
  },
  {
    code: 'sw',
    name: 'Swahili',
    nativeName: 'Kiswahili',
    letter: 'A',
    weave: 'Kanga orange',
    hex: '#b4570e',
    storyFont: LATIN,
    speech: 'sw-KE',
    reviewed: false,
  },
  {
    code: 'ne',
    name: 'Nepali',
    nativeName: 'नेपाली',
    letter: 'क',
    weave: 'Dhaka teal',
    hex: '#0e7490',
    storyFont: DEVANAGARI,
    speech: 'ne-NP',
    reviewed: false,
  },
  {
    code: 'zu',
    name: 'isiZulu',
    nativeName: 'isiZulu',
    letter: 'A',
    weave: 'Beadwork violet',
    hex: '#6b3fa0',
    storyFont: LATIN,
    speech: 'zu-ZA',
    reviewed: false,
  },
]

export const LANGUAGES = Object.fromEntries(ENTRIES.map((e) => [e.code, { ...e, ...colours(e.hex) }])) as Record<
  LanguageCode,
  Language
>

export const LANGUAGE_ORDER: LanguageCode[] = ENTRIES.map((e) => e.code)

/** Languages native speakers have already checked books in; the home screen leads with these. */
export const REVIEWED_LANGUAGES: LanguageCode[] = ENTRIES.filter((e) => e.reviewed).map((e) => e.code)

/** Display details for any story language, including English (the second language in two-language books). */
export function languageDisplay(code: LanguageCode | 'en') {
  if (code === 'en') {
    return {
      name: 'English',
      nativeName: 'English',
      color: 'var(--color-ink)',
      storyFont: 'var(--font-display)',
      speech: 'en-IN',
    }
  }
  return LANGUAGES[code]
}

export const READING_LEVELS = [
  { id: 1, label: 'First words', ages: '3–5' },
  { id: 2, label: 'Short sentences', ages: '5–7' },
  { id: 3, label: 'Little stories', ages: '7–9' },
] as const

export type ReadingLevel = (typeof READING_LEVELS)[number]['id']
