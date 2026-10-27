import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookCover } from '../components/BookCover'
import { SAMPLE_BOOKS } from '../data/sampleBooks'
import { LANGUAGE_ORDER, LANGUAGES, READING_LEVELS, type LanguageCode, type ReadingLevel } from '../lib/languages'

export function LibraryPage() {
  const [language, setLanguage] = useState<LanguageCode | null>(null)
  const [level, setLevel] = useState<ReadingLevel | null>(null)

  const books = SAMPLE_BOOKS
  const shown = useMemo(
    () => books.filter((b) => (!language || b.language === language) && (!level || b.level === level)),
    [books, language, level],
  )

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <section className="notebook -mx-4 mb-10 px-4 pt-10 pb-9 sm:mx-0 sm:mt-6 sm:rounded-3xl sm:px-6 sm:pl-16">
        <h1 className="max-w-xl pl-10 font-[family-name:var(--font-display)] text-[2.1rem] leading-[1.15] font-semibold text-ink sm:pl-0 sm:text-5xl sm:leading-[1.1]">
          Picture books in your child's own language
        </h1>
        <p className="mt-3 max-w-lg pl-10 text-ink-soft sm:pl-0">
          Every story is written first in the language, then checked by people who speak it.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-2.5 sm:max-w-2xl sm:gap-4" role="group" aria-label="Choose a language">
          {LANGUAGE_ORDER.map((code) => {
            const lang = LANGUAGES[code]
            const active = language === code
            const count = books.filter((b) => b.language === code).length
            return (
              <button
                key={code}
                type="button"
                aria-pressed={active}
                onClick={() => setLanguage(active ? null : code)}
                className="flex min-h-28 flex-col items-start justify-between rounded-2xl border-2 p-3 text-left transition-colors sm:min-h-32 sm:p-4"
                style={{
                  borderColor: lang.color,
                  background: active ? lang.color : 'var(--color-sheet)',
                  color: active ? '#fff' : lang.color,
                }}
              >
                <span lang={code} className="pt-1 text-[1.6rem] leading-[1.3] font-semibold sm:text-4xl" style={{ fontFamily: lang.storyFont }}>
                  {lang.nativeName}
                </span>
                <span className={`text-xs leading-snug sm:text-sm ${active ? 'text-white/85' : 'text-ink-soft'}`}>
                  {lang.name}
                  <br />
                  {count} {count === 1 ? 'book' : 'books'}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
          {language ? `${LANGUAGES[language].name} books` : 'All books'}
        </h2>
        <div className="flex overflow-x-auto rounded-full border border-rule bg-sheet p-1" role="group" aria-label="Reading level">
          <LevelButton active={level === null} onClick={() => setLevel(null)}>
            All ages
          </LevelButton>
          {READING_LEVELS.map((l) => (
            <LevelButton key={l.id} active={level === l.id} onClick={() => setLevel(l.id)}>
              {l.ages}
            </LevelButton>
          ))}
        </div>
      </div>

      {shown.length > 0 ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          {shown.map((book) => (
            <li key={book.id}>
              <BookCover book={book} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-rule px-6 py-12 text-center">
          <p className="font-medium">No books here yet.</p>
          <p className="mt-1 text-ink-soft">Try another age, or make the first one.</p>
          <Link
            to="/create"
            className="mt-5 inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink-soft"
          >
            Create a book
          </Link>
        </div>
      )}
    </main>
  )
}

function LevelButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-9 shrink-0 rounded-full px-3.5 text-sm whitespace-nowrap transition-colors ${
        active ? 'bg-ink font-medium text-white' : 'text-ink-soft hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
