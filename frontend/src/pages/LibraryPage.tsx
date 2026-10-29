import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookCover } from '../components/BookCover'
import { LanguageTile } from '../components/LanguageTile'
import { api, toSummary } from '../lib/api'
import { useT } from '../lib/i18n'
import { LANGUAGE_ORDER, READING_LEVELS, type LanguageCode, type ReadingLevel } from '../lib/languages'
import type { BookKind, BookSummary } from '../lib/types'

const KINDS = [
  ['folk-tale', 'library.folkTales'],
  ['original', 'library.newStories'],
  ['two-language', 'library.twoLanguages'],
] as const satisfies readonly (readonly [BookKind, string])[]

export function LibraryPage() {
  const [language, setLanguage] = useState<LanguageCode | null>(null)
  const [level, setLevel] = useState<ReadingLevel | null>(null)
  const [kind, setKind] = useState<BookKind | null>(null)
  const [books, setBooks] = useState<BookSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const t = useT()

  useEffect(() => {
    api
      .listBooks()
      .then((list) => setBooks(list.map(toSummary)))
      .catch((e: Error) => setError(e.message))
  }, [])

  const shown = useMemo(
    () =>
      (books ?? []).filter(
        (b) => (!language || b.language === language) && (!level || b.level === level) && (!kind || b.kind === kind),
      ),
    [books, language, level, kind],
  )

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <section className="notebook -mx-4 mb-10 px-4 pt-10 pb-9 sm:mx-0 sm:mt-6 sm:rounded-3xl sm:px-6 sm:pl-16">
        <h1 className="max-w-xl pl-10 font-[family-name:var(--font-display)] text-[2.1rem] leading-[1.15] font-semibold text-ink sm:pl-0 sm:text-5xl sm:leading-[1.1]">
          {t('library.title')}
        </h1>
        <p className="mt-3 max-w-lg pl-10 text-ink-soft sm:pl-0">
          {t('library.subtitle')}
        </p>

        <div
          className="mt-8 grid grid-cols-3 gap-2.5 sm:max-w-2xl sm:gap-4"
          role="group"
          aria-label={t('library.chooseLanguage')}
        >
          {LANGUAGE_ORDER.map((code) => {
            const active = language === code
            const count = (books ?? []).filter((b) => b.language === code).length
            return (
              <LanguageTile
                key={code}
                code={code}
                selected={active}
                onSelect={() => setLanguage(active ? null : code)}
                sublabel={
                  <>
                    {t(`lang.${code}`)}
                    <br />
                    {t(count === 1 ? 'library.bookCount.one' : 'library.bookCount.many', { count })}
                  </>
                }
              />
            )
          })}
        </div>
      </section>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          {language ? t('library.languageBooks', { lang: t(`lang.${language}`) }) : t('library.allBooks')}
        </h2>
        <div className="flex flex-wrap gap-2">
          <div
            className="flex overflow-x-auto rounded-full border border-rule bg-sheet p-1"
            role="group"
            aria-label={t('library.kind')}
          >
            <LevelButton active={kind === null} onClick={() => setKind(null)}>
              {t('library.allKinds')}
            </LevelButton>
            {KINDS.map(([id, name]) => (
              <LevelButton key={id} active={kind === id} onClick={() => setKind(id)}>
                {t(name)}
              </LevelButton>
            ))}
          </div>
          <div
            className="flex overflow-x-auto rounded-full border border-rule bg-sheet p-1"
            role="group"
            aria-label={t('library.level')}
          >
            <LevelButton active={level === null} onClick={() => setLevel(null)}>
              {t('library.allAges')}
            </LevelButton>
            {READING_LEVELS.map((l) => (
              <LevelButton key={l.id} active={level === l.id} onClick={() => setLevel(l.id)}>
                {l.ages}
              </LevelButton>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-2xl border-2 border-margin/40 bg-sheet px-6 py-8 text-center">
          {error}
        </p>
      ) : books === null ? (
        <ul
          className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6"
          aria-label={t('library.loading')}
        >
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="aspect-[3/4] animate-pulse rounded-[var(--radius-cover)] bg-rule/40" />
          ))}
        </ul>
      ) : shown.length > 0 ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          {shown.map((book) => (
            <li key={book.id}>
              <BookCover book={book} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-rule px-6 py-12 text-center">
          <p className="font-medium">{t('library.empty')}</p>
          <p className="mt-1 text-ink-soft">{t('library.emptyHint')}</p>
          <Link
            to="/create"
            className="mt-5 inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-on-ink hover:bg-ink-soft"
          >
            {t('nav.create')}
          </Link>
        </div>
      )}
    </main>
  )
}

function LevelButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-9 shrink-0 rounded-full px-3.5 text-sm whitespace-nowrap transition-colors ${
        active ? 'bg-ink font-medium text-on-ink' : 'text-ink-soft hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
