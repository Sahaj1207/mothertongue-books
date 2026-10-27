import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type AnyLanguage, type Book } from '../lib/api'
import { languageDisplay, LANGUAGES } from '../lib/languages'

function fontFor(lang: AnyLanguage) {
  return languageDisplay(lang).storyFont
}

export function ReaderPage() {
  const { id } = useParams()
  const [book, setBook] = useState<Book | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    api
      .getBook(id!)
      .then(setBook)
      .catch((e: Error) => setError(e.message))
  }, [id])

  const total = book?.drafts[0].pages.length ?? 0
  const go = useCallback((delta: number) => setPage((p) => Math.min(Math.max(p + delta, 0), total - 1)), [total])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <p className="font-medium">{error}</p>
        <Link to="/" className="mt-4 inline-block underline underline-offset-4">
          Back to the library
        </Link>
      </main>
    )
  }
  if (!book) {
    return <main className="mx-auto max-w-3xl px-4 py-12 text-ink-soft">Opening the book…</main>
  }

  const [main, second] = book.drafts
  const lang = LANGUAGES[book.request.language]
  const scene = book.plan.pages[page]?.scene
  const isLast = page === total - 1

  async function publish() {
    setPublishing(true)
    try {
      setBook(await api.publishBook(book!.id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10 lg:max-w-6xl">
      {book.status === 'draft' && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-turmeric-soft px-4 py-3">
          <p className="text-sm">This book is a draft. Only people with the link can see it.</p>
          <button
            type="button"
            onClick={publish}
            disabled={publishing}
            className="h-10 rounded-full bg-ink px-4 text-sm font-medium text-white hover:bg-ink-soft disabled:opacity-60"
          >
            {publishing ? 'Publishing…' : 'Publish to the library'}
          </button>
        </div>
      )}

      <header className="flex items-end justify-between gap-4">
        <div>
          <Link to="/" className="text-sm text-ink-soft underline-offset-4 hover:underline">
            Library
          </Link>
          <h1
            lang={main.language}
            className="mt-1 text-[2rem] leading-[1.35] font-semibold sm:text-[2.6rem]"
            style={{ fontFamily: fontFor(main.language), color: lang.color }}
          >
            {main.title}
          </h1>
          {second && (
            <p lang={second.language} className="text-lg text-ink-soft" style={{ fontFamily: fontFor(second.language) }}>
              {second.title}
            </p>
          )}
        </div>
        <p className="shrink-0 pb-2 text-sm text-ink-faint" aria-live="polite">
          Page {page + 1} of {total}
        </p>
      </header>

      <article className="mt-6 overflow-hidden rounded-3xl border border-rule bg-sheet lg:grid lg:grid-cols-2">
        <figure
          className="flex aspect-[4/3] items-end p-5 sm:aspect-[16/9] lg:aspect-auto lg:min-h-[28rem]"
          style={{ background: lang.softColor }}
          aria-label="Picture for this page"
        >
          <figcaption className="max-w-md text-sm text-ink-soft">
            <span className="font-medium text-ink">Picture: </span>
            {scene}
          </figcaption>
        </figure>
        <div className="notebook min-h-48 py-[0.9rem] pr-5 pl-16 sm:pl-20 lg:py-[2.25rem]">
          <p
            lang={main.language}
            className="text-[1.6rem] leading-[2.25rem] font-medium sm:text-[1.9rem]"
            style={{ fontFamily: fontFor(main.language) }}
          >
            {main.pages[page].text}
          </p>
          {second && (
            <p
              lang={second.language}
              className="mt-[2.25rem] text-lg leading-[2.25rem] text-ink-soft"
              style={{ fontFamily: fontFor(second.language) }}
            >
              {second.pages[page]?.text}
            </p>
          )}
        </div>
      </article>

      <nav className="mt-6 flex items-center justify-between gap-4" aria-label="Pages">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={page === 0}
          className="h-14 min-w-28 rounded-full border-2 border-ink px-6 font-semibold disabled:border-rule disabled:text-ink-faint"
        >
          Back
        </button>
        <ol className="hidden items-center gap-2 sm:flex">
          {main.pages.map((p, i) => (
            <li key={p.number}>
              <button
                type="button"
                onClick={() => setPage(i)}
                aria-label={`Page ${i + 1}`}
                aria-current={i === page ? 'page' : undefined}
                className="block h-3 w-3 rounded-full transition-colors"
                style={{ background: i === page ? lang.color : 'var(--color-rule)' }}
              />
            </li>
          ))}
        </ol>
        {isLast ? (
          <Link
            to="/"
            className="inline-flex h-14 min-w-28 items-center justify-center rounded-full bg-ink px-6 font-semibold text-white hover:bg-ink-soft"
          >
            The end
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => go(1)}
            className="h-14 min-w-28 rounded-full bg-ink px-6 font-semibold text-white hover:bg-ink-soft"
          >
            Next
          </button>
        )}
      </nav>
    </main>
  )
}
