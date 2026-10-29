import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { LANGUAGES, READING_LEVELS } from '../lib/languages'
import type { BookSummary } from '../lib/types'

export function BookCover({ book }: { book: BookSummary }) {
  const lang = LANGUAGES[book.language]
  const level = READING_LEVELS.find((l) => l.id === book.level)!
  const { t, language } = useI18n()
  const kind = t(`kind.${book.kind}`)
  const ages = t('common.ages', { ages: level.ages })
  // The English title helps adults browsing in English; in another website language the cover title is enough.
  const subtitle = language === 'en' ? book.titleEn : null

  return (
    <Link
      to={`/books/${book.id}`}
      className="group block rounded-[var(--radius-cover)] focus-visible:outline-offset-4"
      aria-label={`${book.title}, ${t(`lang.${book.language}`)}, ${ages}`}
    >
      <div
        className="relative flex aspect-[3/4] overflow-hidden rounded-[var(--radius-cover)] transition-transform duration-200 group-hover:-translate-y-1 group-active:translate-y-0"
        style={{ background: lang.softColor, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${lang.color} 18%, transparent)` }}
      >
        <div className="weave w-3.5 shrink-0" style={{ '--weave-color': lang.color } as React.CSSProperties} />
        {book.coverUrl ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <img src={book.coverUrl} alt="" loading="lazy" className="aspect-square w-full object-cover" />
            <div className="flex flex-1 flex-col justify-center px-3 py-2">
              <p
                lang={book.language}
                className="line-clamp-2 text-[1.1rem] leading-snug font-semibold sm:text-[1.25rem]"
                style={{ fontFamily: lang.storyFont, color: lang.color }}
              >
                {book.title}
              </p>
            </div>
          </div>
        ) : (
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
              {book.pairLanguage && ` ${t('cover.withLanguage', { lang: t(`lang.${book.pairLanguage}`) })}`}
            </p>
          </div>
        )}
      </div>
      <div className="mt-2.5 px-0.5">
        {subtitle && <p className="leading-snug font-medium text-ink">{subtitle}</p>}
        <p className="mt-0.5 text-sm text-ink-faint">
          {kind}, <span className="whitespace-nowrap">{ages}</span>
        </p>
      </div>
    </Link>
  )
}
