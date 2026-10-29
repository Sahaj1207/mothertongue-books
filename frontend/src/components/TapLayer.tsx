import { useEffect, useState } from 'react'
import type { AnyLanguage, TapWord } from '../lib/api'
import { useT } from '../lib/i18n'
import { languageDisplay } from '../lib/languages'

const SPEECH_LANG: Record<AnyLanguage, string> = { te: 'te-IN', kn: 'kn-IN', mr: 'mr-IN', en: 'en-IN' }

/** A voice for the language on this device, if it has one. Voices load asynchronously in most browsers. */
export function useVoice(language: AnyLanguage): SpeechSynthesisVoice | null {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const prefix = SPEECH_LANG[language].slice(0, 2)
    const pick = () => setVoice(speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(prefix)) ?? null)
    pick()
    speechSynthesis.addEventListener('voiceschanged', pick)
    return () => speechSynthesis.removeEventListener('voiceschanged', pick)
  }, [language])
  return voice
}

/** Says a word slowly in the device's voice for its language; does nothing without one. */
export function speak(voice: SpeechSynthesisVoice | null, text: string) {
  if (!voice || !text) return
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = 0.8
  speechSynthesis.speak(utterance)
}

interface Props {
  words: TapWord[]
  /** Book languages, main first. */
  languages: AnyLanguage[]
}

export function TapLayer({ words, languages }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [main, second] = languages
  const voice = useVoice(main)
  const t = useT()
  const word = selected === null ? null : words[selected]

  const say = (text: string) => speak(voice, text)

  function choose(index: number) {
    setSelected(index)
    say(words[index].words[main] ?? '')
  }

  return (
    <>
      {words.map((w, i) => {
        const [x1, y1, x2, y2] = w.box
        const active = selected === i
        return (
          <button
            key={`${w.english}-${i}`}
            type="button"
            onClick={() => choose(i)}
            aria-label={`${w.words[main] ?? w.english}, ${w.english}`}
            aria-pressed={active}
            // The ::before keeps small objects (a handbag, a cup) at least finger-sized to tap.
            className={`absolute rounded-2xl transition-shadow before:absolute before:top-1/2 before:left-1/2 before:h-full before:min-h-11 before:w-full before:min-w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] focus-visible:outline-none ${
              active
                ? 'shadow-[0_0_0_4px_var(--color-turmeric),0_0_0_9px_rgb(242_183_5/0.35)]'
                : 'focus-visible:shadow-[0_0_0_4px_var(--color-turmeric)]'
            }`}
            style={{
              left: `${x1 * 100}%`,
              top: `${y1 * 100}%`,
              width: `${(x2 - x1) * 100}%`,
              height: `${(y2 - y1) * 100}%`,
            }}
          />
        )
      })}

      {word ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center" aria-live="polite">
          <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl bg-sheet/95 py-2.5 pr-2.5 pl-4 shadow-lg ring-1 ring-rule backdrop-blur">
            <div className="min-w-0">
              <p
                lang={main}
                className="truncate text-[1.9rem] leading-tight font-semibold"
                style={{ fontFamily: languageDisplay(main).storyFont, color: languageDisplay(main).color }}
              >
                {word.words[main]}
              </p>
              <p className="truncate text-sm text-ink-soft">
                {second && word.words[second] && (
                  <span lang={second} style={{ fontFamily: languageDisplay(second).storyFont }}>
                    {word.words[second]},{' '}
                  </span>
                )}
                {word.english}
              </p>
            </div>
            {voice && (
              <button
                type="button"
                onClick={() => say(word.words[main] ?? '')}
                aria-label={t('tap.hear', { word: word.words[main] ?? '' })}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-turmeric text-ink hover:bg-turmeric/80"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                  <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
                  <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label={t('common.close')}
              className="flex h-12 w-10 shrink-0 items-center justify-center rounded-full text-ink-faint hover:text-ink"
            >
              ×
            </button>
          </div>
        </div>
      ) : (
        <p className="pointer-events-none absolute top-3 left-3 rounded-full bg-sheet/90 px-3 py-1.5 text-xs font-medium text-ink shadow-sm">
          {t('tap.hint')}
        </p>
      )}
    </>
  )
}
