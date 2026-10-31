import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AskForLanguage } from '../components/AskForLanguage'
import { BookCover, isNew } from '../components/BookCover'
import { FALLBACK_DEMO, HomeHero, HomeStory, type DemoPage } from '../components/HomeHero'
import { LanguageTile } from '../components/LanguageTile'
import { api, toSummary, type Book } from '../lib/api'
import { useT } from '../lib/i18n'
import { LANGUAGE_ORDER, READING_LEVELS, languageDisplay, type LanguageCode, type ReadingLevel } from '../lib/languages'
import type { BookKind, BookSummary } from '../lib/types'
import { usePageTitle } from '../lib/title'

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
  const [searchText, setSearchText] = useState<Map<string, string>>(new Map())
  const [query, setQuery] = useState('')
  const [demo, setDemo] = useState<DemoPage>(FALLBACK_DEMO)
  const [error, setError] = useState<string | null>(null)
  const t = useT()
  usePageTitle(null)

  useEffect(() => {
    api
      .listBooks()
      .then((list) => {
        setBooks(list.map(toSummary))
        setSearchText(new Map(list.map((b) => [b.id, searchableText(b)])))
        const page = demoPage(list)
        if (page) setDemo(page)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  const shown = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean)
    return (books ?? []).filter(
      (b) =>
        (!language || b.language === language) &&
        (!level || b.level === level) &&
        (!kind || b.kind === kind) &&
        terms.every((term) => searchText.get(b.id)?.includes(term)),
    )
  }, [books, searchText, query, language, level, kind])
  const newThisWeek = (books ?? []).filter(isNew).length

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <HomeHero demo={demo} firstBook={books?.find((b) => b.coverUrl) ?? books?.[0] ?? null} />
      <HomeStory />

      <section id="books" className="mt-12 scroll-mt-20">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{t('library.chooseLanguage')}</h2>
        <div
          className="mt-3 grid grid-cols-3 gap-2.5 sm:max-w-2xl sm:gap-4"
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
        <AskForLanguage />
      </section>

      <div className="mt-10 mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            {language ? t('library.languageBooks', { lang: t(`lang.${language}`) }) : t('library.allBooks')}
          </h2>
          {newThisWeek > 0 && (
            <p className="rounded-full bg-turmeric-soft px-3 py-1 text-sm font-medium">
              {t('library.newThisWeek', { count: newThisWeek })}
            </p>
          )}
        </div>
        <div className="relative mt-4 sm:max-w-md">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-ink-faint"
          >
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('library.search')}
            placeholder={t('library.searchHint')}
            className="h-12 w-full rounded-full border-2 border-rule bg-sheet pr-12 pl-11 text-base placeholder:text-ink-faint focus:border-ink focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('library.clearSearch')}
              className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft hover:bg-rule/50 hover:text-ink"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        {/* Chips wrap instead of scrolling sideways, so no choice is hidden off the edge of a phone. */}
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t('library.kind')}>
          <FilterChip active={kind === null} onClick={() => setKind(null)}>
            {t('library.allKinds')}
          </FilterChip>
          {KINDS.map(([id, name]) => (
            <FilterChip key={id} active={kind === id} onClick={() => setKind(id)}>
              {t(name)}
            </FilterChip>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t('library.level')}>
          <FilterChip active={level === null} onClick={() => setLevel(null)}>
            {t('library.allAges')}
          </FilterChip>
          {READING_LEVELS.map((l) => (
            <FilterChip key={l.id} active={level === l.id} onClick={() => setLevel(l.id)}>
              {l.ages}
            </FilterChip>
          ))}
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
      ) : query.trim() ? (
        <div className="rounded-2xl border-2 border-dashed border-rule px-6 py-12 text-center">
          <p className="font-medium">{t('library.noMatch', { query: query.trim() })}</p>
          <p className="mt-1 text-ink-soft">{t('library.noMatchHint')}</p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="mt-5 inline-flex h-11 items-center rounded-full border-2 border-ink px-5 text-sm font-medium hover:bg-ink hover:text-on-ink"
          >
            {t('library.clearSearch')}
          </button>
        </div>
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

function FilterChip({
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
      className={`h-10 rounded-full border px-4 text-sm whitespace-nowrap transition-colors ${
        active
          ? 'border-ink bg-ink font-medium text-on-ink'
          : 'border-rule bg-sheet text-ink-soft hover:border-ink-faint hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function normalize(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase()
}

/** Everything a parent might search a book by: titles in every language, the topic, the tale's tradition,
 * the language's names, the story itself and its tap words. */
function searchableText(book: Book): string {
  const parts = [book.plan.title_en, book.request.topic, book.request.source ?? '']
  for (const draft of book.drafts) {
    const lang = languageDisplay(draft.language)
    parts.push(draft.title, lang.name, lang.nativeName, ...draft.pages.map((p) => p.text))
  }
  for (const words of Object.values(book.words ?? {})) {
    for (const word of words) parts.push(word.english, ...Object.values(word.words).filter((w) => w !== undefined))
  }
  return normalize(parts.join(' '))
}

/** The newest published page that has words to tap, for the home screen's try-it page. */
function demoPage(books: Book[]): DemoPage | null {
  for (const book of books) {
    const main = book.drafts[0]
    for (const page of main.pages) {
      const words = book.words?.[String(page.number)]
      const image = book.images?.[String(page.number)]
      if (words?.length && image) {
        return { bookId: book.id, language: main.language, image, text: page.text, words }
      }
    }
  }
  return null
}
