import { useEffect, useState } from 'react'
import type { AnyLanguage } from '../lib/api'
import { useT } from '../lib/i18n'
import { stopSpeaking, useSpeaker } from '../lib/speech'

/**
 * Reads the page aloud in Meta's voice for its language, or the device's voice where there isn't one.
 * Hidden when there is neither, so a child never presses a button that stays silent.
 */
export function ListenButton({
  language,
  bookId,
  text,
  className = '',
}: {
  language: AnyLanguage
  bookId: string
  text: string
  className?: string
}) {
  const speaker = useSpeaker(language, bookId)
  const [speaking, setSpeaking] = useState(false)
  const t = useT()

  // Get the page's clip ready while the child looks at the picture. A new page, or leaving the book,
  // stops the reading.
  useEffect(() => {
    speaker.prepare([text])
    return () => stopSpeaking()
  }, [text, speaker.available])

  if (!speaker.available) return null

  function toggle() {
    if (speaking) return stopSpeaking()
    setSpeaking(true)
    speaker.say(text, 'page', () => setSpeaking(false))
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
