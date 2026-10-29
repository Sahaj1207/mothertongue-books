import { Link } from 'react-router-dom'
import { useT } from '../lib/i18n'

/** After the last page: a moment to celebrate, then read again, go over the words, or pick another book. */
export function BookEnd({
  title,
  titleLang,
  titleFont,
  color,
  hasWords,
  onReadAgain,
}: {
  title: string
  titleLang: string
  titleFont: string
  color: string
  hasWords: boolean
  onReadAgain: () => void
}) {
  const t = useT()
  return (
    <section className="book-end mt-6 rounded-3xl border border-rule bg-sheet px-6 py-10 text-center sm:py-14">
      <svg viewBox="0 0 120 120" className="mx-auto h-28 w-28" aria-hidden="true">
        <g className="end-rays" stroke="var(--color-turmeric)" strokeWidth="5" strokeLinecap="round">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4
            return (
              <line
                key={i}
                x1={60 + Math.cos(a) * 44}
                y1={60 + Math.sin(a) * 44}
                x2={60 + Math.cos(a) * 56}
                y2={60 + Math.sin(a) * 56}
              />
            )
          })}
        </g>
        <path
          className="end-star"
          d="M60 22l10.6 21.5 23.7 3.4-17.2 16.7 4.1 23.6L60 76l-21.2 11.2 4.1-23.6-17.2-16.7 23.7-3.4z"
          fill="var(--color-turmeric)"
          stroke="#1f2a44"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
      <h2 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">
        {t('end.title')}
      </h2>
      <p lang={titleLang} className="mt-2 text-xl font-semibold" style={{ fontFamily: titleFont, color }}>
        {title}
      </p>
      <div className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={onReadAgain}
          className="h-14 rounded-full bg-ink px-6 font-semibold text-on-ink hover:bg-ink-soft sm:flex-1"
        >
          {t('end.again')}
        </button>
        {hasWords && (
          <a
            href="#book-words"
            className="inline-flex h-14 items-center justify-center rounded-full border-2 border-ink px-6 font-semibold sm:flex-1"
          >
            {t('words.title')}
          </a>
        )}
      </div>
      <Link to="/" className="mt-5 inline-block font-medium text-ink-soft underline underline-offset-4 hover:text-ink">
        {t('end.another')}
      </Link>
    </section>
  )
}
