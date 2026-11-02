import { useEffect } from 'react'
import type { AnyLanguage } from '../lib/api'
import { useT } from '../lib/i18n'
import { languageDisplay } from '../lib/languages'
import type { BookWord } from '../lib/words'
import { useSpeaker } from '../lib/speech'
import { WordThumb } from './WordThumb'

/** The end-of-book page: every word the child could tap, with its picture, to say again. */
export function BookWords({
  words,
  languages,
  bookId,
}: {
  words: BookWord[]
  languages: AnyLanguage[]
  bookId: string
}) {
  const [main, second] = languages
  const speaker = useSpeaker(main, bookId)
  useEffect(() => {
    speaker.prepare(words.map((w) => w.words[main] ?? ''))
  }, [words, main, speaker.available])
  const t = useT()
  const display = languageDisplay(main)
  return (
    <section className="mt-10" aria-labelledby="book-words">
      <h2 id="book-words" className="font-[family-name:var(--font-display)] text-2xl font-semibold">
        {t('words.title')}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">{speaker.available ? t('words.tapToHear') : t('words.sayTogether')}</p>
      <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {words.map((w) => (
          <li key={w.english}>
            <button
              type="button"
              onClick={() => speaker.say(w.words[main] ?? '', 'word')}
              disabled={!speaker.available}
              aria-label={`${w.words[main] ?? w.english}, ${w.english}`}
              className="block w-full overflow-hidden rounded-2xl border border-rule bg-sheet text-center transition-colors enabled:hover:border-ink-faint"
            >
              <WordThumb image={w.image} box={w.box} className="w-full" />
              <span
                className="block px-1.5 pt-1.5 text-lg leading-tight font-semibold"
                lang={main}
                style={{ fontFamily: display.storyFont, color: display.color }}
              >
                {w.words[main]}
              </span>
              {second && w.words[second] && (
                <span
                  className="block px-1.5 text-sm text-ink-soft"
                  lang={second}
                  style={{ fontFamily: languageDisplay(second).storyFont }}
                >
                  {w.words[second]}
                </span>
              )}
              <span className="block px-1.5 pb-2 text-xs text-ink-faint">{w.english}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
