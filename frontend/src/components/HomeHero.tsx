import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { AnyLanguage, TapWord } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { LANGUAGE_ORDER, LANGUAGES, type LanguageCode } from '../lib/languages'
import type { BookSummary } from '../lib/types'
import { TapLayer } from './TapLayer'

export interface DemoPage {
  bookId: string | null
  language: AnyLanguage
  image: string
  text: string
  words: TapWord[]
}

// Shown until a published book has a page with tap words: page 1 of Punyakoti.
export const FALLBACK_DEMO: DemoPage = {
  bookId: null,
  language: 'kn',
  image:
    'https://pvyraebnujmjpyqrfhbp.supabase.co/storage/v1/object/public/book-assets/aa8018e9-7e10-4377-89e8-316c5bb51967/page-1.webp?v=7c1e52c210',
  text: 'ಕಾಡಿನ ಪಕ್ಕದ ಹಸಿರು ಊರಿನಲ್ಲಿ ಪುಣ್ಯಕೋಟಿ ಎಂಬ ಬಿಳಿ ಹಸು ಇತ್ತು.',
  words: [
    { english: 'white cow', words: { kn: 'ಹಸು' }, box: [0.121, 0.22, 0.695, 0.952] },
    { english: 'thatched hut', words: { kn: 'ಗುಡಿಸಲು' }, box: [0.531, 0.043, 1, 0.691] },
    { english: 'coconut palm tree', words: { kn: 'ಮರ' }, box: [0.169, 0.003, 0.542, 0.6] },
  ],
}

/** On the English site the hook cycles through every language; on a Telugu, Kannada or Marathi site it names that one. */
function useHookLanguage(): LanguageCode {
  const { language } = useI18n()
  const [index, setIndex] = useState(0)
  const fixed = language !== 'en'
  useEffect(() => {
    if (fixed || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % LANGUAGE_ORDER.length), 2600)
    return () => window.clearInterval(timer)
  }, [fixed])
  return fixed ? (language as LanguageCode) : LANGUAGE_ORDER[index]
}

export function HomeHero({ demo, firstBook }: { demo: DemoPage; firstBook: BookSummary | null }) {
  const { t, language } = useI18n()
  const navigate = useNavigate()
  const hookLanguage = useHookLanguage()
  // In English the language shows in its own script (ಕನ್ನಡ, Kiswahili, नेपाली); elsewhere by its local name.
  const ownScript = language === 'en'
  const [before, after = ''] = t('home.hook').split('{lang}')
  const lang = LANGUAGES[hookLanguage]

  function readFree() {
    if (firstBook) navigate(`/books/${firstBook.id}`)
    else document.getElementById('books')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="notebook -mx-4 px-4 pt-8 pb-9 sm:mx-0 sm:mt-6 sm:rounded-3xl sm:px-6 sm:pl-16 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10 lg:pr-10">
      {/* Everything sits right of the red margin line, as on a real exercise-book page. */}
      <div className="pl-10 sm:pl-0">
        <p className="text-sm text-ink-soft">
          {LANGUAGE_ORDER.map((code, i) => (
            <span key={code} lang={code} style={{ fontFamily: LANGUAGES[code].storyFont }}>
              {i > 0 && ' · '}
              {LANGUAGES[code].nativeName}
            </span>
          ))}
        </p>
        {/* Room for the longest name, so the page doesn't jump as the language changes. */}
        <h1 className="mt-2 min-h-[3.45em] font-[family-name:var(--font-display)] text-[2rem] leading-[1.15] font-semibold text-ink sm:min-h-[2.2em] sm:text-5xl sm:leading-[1.08]">
          {before}
          <span
            key={hookLanguage}
            lang={ownScript ? hookLanguage : undefined}
            className="hook-word"
            style={{ color: lang.color, fontFamily: ownScript ? lang.storyFont : undefined }}
          >
            {ownScript ? lang.nativeName : t(`lang.${hookLanguage}`)}
          </span>
          {after}
        </h1>
        <p className="mt-4 max-w-xl text-ink-soft sm:text-lg">{t('home.sub')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={readFree}
            className="h-12 flex-1 rounded-full bg-ink px-6 font-semibold whitespace-nowrap text-on-ink hover:bg-ink-soft sm:flex-none"
          >
            {t('home.read')}
          </button>
          <Link
            to="/create"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full border-2 border-ink px-6 font-semibold whitespace-nowrap sm:flex-none"
          >
            {t('home.make')}
          </Link>
        </div>
        <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
          {(['home.promise1', 'home.promise2', 'home.promise3'] as const).map((key) => (
            <li key={key} className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-kannada" aria-hidden="true">
                <path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              </svg>
              {t(key)}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 pl-10 sm:pl-0 lg:mt-0">
        <div className="overflow-hidden rounded-3xl border border-rule bg-sheet shadow-sm">
          <div className="relative aspect-square">
            <img src={demo.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <TapLayer words={demo.words} languages={[demo.language]} />
          </div>
          <p
            lang={demo.language}
            className="px-4 py-3 text-lg leading-relaxed font-medium"
            style={{ fontFamily: LANGUAGES[demo.language as LanguageCode]?.storyFont }}
          >
            {demo.text}
          </p>
        </div>
        <p className="mt-2 text-center text-sm text-ink-faint">
          {t('home.tryIt')}
          {demo.bookId && (
            <>
              {' · '}
              <Link to={`/books/${demo.bookId}`} className="underline underline-offset-4 hover:text-ink">
                {t('home.readThisBook')}
              </Link>
            </>
          )}
        </p>
      </div>
    </section>
  )
}

/** How it works in three steps, why it matters, and an invitation for tonight. */
export function HomeStory() {
  const { t } = useI18n()
  return (
    <section className="mt-10 grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-3xl border border-rule bg-sheet p-5 sm:p-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">{t('home.howTitle')}</h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {(['home.step1', 'home.step2', 'home.step3'] as const).map((key, i) => (
            <li key={key} className="flex gap-3 rounded-2xl bg-paper p-3.5 sm:block">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-turmeric font-semibold text-ink sm:mb-2">
                {i + 1}
              </span>
              <span className="text-sm leading-snug">{t(key)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 border-t border-rule pt-4 text-sm text-ink-soft">
          <span className="font-semibold text-ink">{t('home.whyTitle')} </span>
          {t('home.why')} <span className="text-ink-faint">({t('home.whySource')})</span>
        </p>
      </div>
      <Link
        to="/create"
        className="group flex flex-col justify-between gap-4 rounded-3xl bg-ink p-5 text-on-ink sm:p-6"
      >
        <span>
          <span className="block font-[family-name:var(--font-display)] text-xl font-semibold">
            {t('home.bedtime')}
          </span>
          <span className="mt-1 block text-sm opacity-85">{t('home.bedtimeHint')}</span>
        </span>
        <span className="inline-flex items-center gap-2 font-semibold">
          {t('home.make')}
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          >
            <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </span>
      </Link>
    </section>
  )
}
