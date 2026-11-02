import { useEffect, useState } from 'react'
import type { AnyLanguage } from '../lib/api'
import { useT } from '../lib/i18n'
import { useVoice } from './TapLayer'

/**
 * Reads the page aloud in the device's voice for its language. Hidden on devices without one,
 * so a child never presses a button that stays silent.
 */
export function ListenButton({
  language,
  text,
  className = '',
}: {
  language: AnyLanguage
  text: string
  className?: string
}) {
  const voice = useVoice(language)
  const [speaking, setSpeaking] = useState(false)
  const t = useT()

  // A new page, or leaving the book, stops the reading.
  useEffect(
    () => () => {
      if ('speechSynthesis' in window) speechSynthesis.cancel()
    },
    [text],
  )

  if (!voice) return null

  function toggle() {
    speechSynthesis.cancel()
    if (speaking) {
      setSpeaking(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    utterance.lang = voice!.lang
    utterance.rate = 0.85
    utterance.onend = utterance.onerror = () => setSpeaking(false)
    setSpeaking(true)
    speechSynthesis.speak(utterance)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      className={`${className} inline-flex h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold transition-colors ${
        speaking ? 'border-ink bg-ink text-on-ink' : 'border-rule bg-sheet hover:border-ink'
      }`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
        {speaking ? (
          <path d="M16 9v6M19.5 9v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <path
            d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
      {speaking ? t('reader.stop') : t('reader.listen')}
    </button>
  )
}
