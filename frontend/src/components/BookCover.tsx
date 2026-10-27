import { Link } from 'react-router-dom'
import { LANGUAGES, READING_LEVELS } from '../lib/languages'
import type { BookSummary } from '../lib/types'

const KIND_LABEL = {
  original: 'New story',
  'two-language': 'Two languages',
  'folk-tale': 'Folk tale',
} as const

export function BookCover({ book }: { book: BookSummary }) {
  const lang = LANGUAGES[book.language]
  const level = READING_LEVELS.find((l) => l.id === book.level)!
  const kind = book.kind === 'folk-tale' && book.source ? `Retold ${book.source} tale` : KIND_LABEL[book.kind]

  return (
    <Link
      to={`/books/${book.id}`}
      className="group block rounded-[var(--radius-cover)] focus-visible:outline-offset-4"
      aria-label={`${book.titleEn}, ${lang.name}, ${level.label}`}
    >
      <div
        className="relative flex aspect-[3/4] overflow-hidden rounded-[var(--radius-cover)] transition-transform duration-200 group-hover:-translate-y-1 group-active:translate-y-0"
        style={{ background: lang.softColor, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${lang.color} 18%, transparent)` }}
      >
        <div className="weave w-3.5 shrink-0" style={{ '--weave-color': lang.color } as React.CSSProperties} />
        <div className="relative flex flex-1 flex-col justify-between p-4">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 bottom-1 text-[4.5rem] leading-[1.4] select-none sm:text-[5.5rem]"
            style={{ fontFamily: lang.storyFont, color: lang.color, opacity: 0.18 }}
          >
            {lang.letter}
          </span>
          <p
            lang={book.language}
            className="relative text-[1.45rem] leading-snug font-semibold text-balance"
            style={{ fontFamily: lang.storyFont, color: lang.color }}
          >
            {book.title}
          </p>
          <p className="relative text-xs font-medium" style={{ color: lang.color }}>
            {lang.nativeName}
            {book.pairLanguage === 'en' && ' + English'}
          </p>
        </div>
      </div>
      <div className="mt-2.5 px-0.5">
        <p className="leading-snug font-medium text-ink">{book.titleEn}</p>
        <p className="mt-0.5 text-sm text-ink-faint">
          {kind}, <span className="whitespace-nowrap">ages {level.ages}</span>
        </p>
      </div>
    </Link>
  )
}
