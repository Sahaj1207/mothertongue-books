import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BookEnd } from '../components/BookEnd'
import { BookWords } from '../components/BookWords'
import { BookSkeleton } from '../components/Skeleton'
import { TapLayer } from '../components/TapLayer'
import { Tips } from '../components/Tips'
import { api, type AnyLanguage, type Book } from '../lib/api'
import { useT } from '../lib/i18n'
import { languageDisplay, LANGUAGES } from '../lib/languages'
import { bookWords } from '../lib/words'
import { usePageTitle } from '../lib/title'

function fontFor(lang: AnyLanguage) {
  return languageDisplay(lang).storyFont
}

export function ReaderPage() {
  const { id } = useParams()
  const [book, setBook] = useState<Book | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [finished, setFinished] = useState(false)
  // Which way the last turn went, so the new page slides in from that side.
  const [direction, setDirection] = useState(1)
  const t = useT()
  usePageTitle(book?.drafts[0].title)

  useEffect(() => {
    api
      .getBook(id!)
      .then(setBook)
      .catch((e: Error) => setError(e.message))
  }, [id])

  const total = book?.drafts[0].pages.length ?? 0
  const go = useCallback(
    (delta: number) => {
      setDirection(delta)
      setPage((p) => Math.min(Math.max(p + delta, 0), total - 1))
    },
    [total],
  )
  const article = useRef<HTMLElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  // A new page starts at its top: on a phone the last page may have been scrolled down to its text.
  useEffect(() => {
    const top = article.current?.getBoundingClientRect().top
    if (top !== undefined && top < 0) window.scrollBy({ top: top - 80, behavior: 'smooth' })
  }, [page, finished])

  // The next picture loads while this page is read, so turning feels instant on a slow phone.
  useEffect(() => {
    const next = book?.drafts[0].pages[page + 1]
    const src = next && book?.images?.[String(next.number)]
    if (src) new Image().src = src
  }, [book, page])

  // Swipe left or right on the page to turn it, like a picture-book app.
  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
  }

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
          {t('common.backToLibrary')}
        </Link>
      </main>
    )
  }
  if (!book) {
    return <BookSkeleton label={t('reader.opening')} />
  }

  const [main, second] = book.drafts
  const lang = LANGUAGES[book.request.language]
  const scene = book.plan.pages[page]?.scene
  const image = book.images?.[String(main.pages[page].number)]
  const tapWords = book.words?.[String(main.pages[page].number)] ?? []
  const isLast = page === total - 1
  const words = bookWords(book)

  return (
    // overflow-x-clip: a page sliding in mustn't make the phone scroll sideways (clip keeps the nav sticky).
    <main className="mx-auto max-w-3xl overflow-x-clip px-4 pt-6 pb-16 sm:px-6 sm:pt-10 lg:max-w-6xl">
      {book.status === 'draft' && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-turmeric-soft px-4 py-3">
          <p className="text-sm">{t('reader.draft')}</p>
          <Link
            to={`/books/${book.id}/review`}
            className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-medium text-on-ink hover:bg-ink-soft"
          >
            {t('reader.reviewAndPublish')}
          </Link>
        </div>
      )}

      <header className="flex items-end justify-between gap-4">
        <div>
          <Link to="/" className="text-sm text-ink-soft underline-offset-4 hover:underline">
            {t('reader.library')}
          </Link>
          <h1
            lang={main.language}
            className="mt-1 text-[2rem] leading-[1.35] font-semibold sm:text-[2.6rem]"
            style={{ fontFamily: fontFor(main.language), color: lang.color }}
          >
            {main.title}
          </h1>
          {second && (
            <p
              lang={second.language}
              className="text-lg text-ink-soft"
              style={{ fontFamily: fontFor(second.language) }}
            >
              {second.title}
            </p>
          )}
          {book.request.kind === 'folk-tale' && (
            <p className="mt-1 text-sm text-ink-faint">
              {book.request.source ? t('reader.retoldFrom', { source: book.request.source }) : t('reader.retold')}
            </p>
          )}
        </div>
        <div className="shrink-0 pb-2 text-right text-sm">
          <Link to={`/books/${book.id}/print`} className="text-ink-soft underline underline-offset-4 hover:text-ink">
            {t('reader.savePdf')}
          </Link>
          <p className="mt-1 text-ink-faint" aria-live="polite">
            {t('reader.pageOf', { page: page + 1, total })}
          </p>
        </div>
      </header>

      {finished ? (
        <BookEnd
          title={main.title}
          titleLang={main.language}
          titleFont={fontFor(main.language)}
          color={lang.color}
          hasWords={words.length > 0}
          onReadAgain={() => {
            setDirection(-1)
            setFinished(false)
            setPage(0)
          }}
        />
      ) : (
        <>
          <article
            key={page}
            ref={article}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            style={{ '--turn': direction < 0 ? '-1.5rem' : '1.5rem' } as React.CSSProperties}
            className="page-turn mt-6 overflow-hidden rounded-3xl border border-rule bg-sheet lg:grid lg:grid-cols-2"
          >
            <figure
              className={`relative flex items-end overflow-hidden ${
                image
                  ? 'mx-auto aspect-square w-full sm:max-w-[34rem] lg:max-w-none'
                  : 'aspect-[4/3] sm:aspect-[16/9] lg:aspect-auto lg:min-h-[28rem]'
              }`}
              style={{ background: lang.softColor }}
            >
              {image ? (
                <>
                  {/* Pictures are square; showing them whole keeps heads and feet in the frame. */}
                  <img
                    key={image}
                    src={image}
                    alt={scene ?? ''}
                    className="absolute inset-0 h-full w-full object-contain"
                    loading={page === 0 ? 'eager' : 'lazy'}
                  />
                  {tapWords.length > 0 && (
                    // Keyed by page so a new page starts with nothing selected.
                    <TapLayer
                      key={page}
                      words={tapWords}
                      languages={book.drafts.map((d) => d.language)}
                      hint={page === 0}
                    />
                  )}
                </>
              ) : (
                <figcaption className="max-w-md p-5 text-sm text-ink-soft">
                  <span className="font-medium text-ink">{t('reader.picture')} </span>
                  {scene}
                </figcaption>
              )}
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

          {/* On phones the page buttons stay at the bottom of the screen, so a child never scrolls to turn a page. */}
          <nav
            className="sticky bottom-0 z-10 -mx-4 mt-4 flex items-center justify-between gap-4 bg-paper/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:mt-6 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
            aria-label={t('reader.pages')}
          >
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={page === 0}
              className="h-14 min-w-28 rounded-full border-2 border-ink px-6 font-semibold disabled:border-rule disabled:text-ink-faint"
            >
              {t('reader.back')}
            </button>
            <ol className="hidden items-center gap-2 sm:flex">
              {main.pages.map((p, i) => (
                <li key={p.number}>
                  <button
                    type="button"
                    onClick={() => {
                      setDirection(i < page ? -1 : 1)
                      setPage(i)
                    }}
                    aria-label={t('reader.pageN', { n: i + 1 })}
                    aria-current={i === page ? 'page' : undefined}
                    className="block h-3 w-3 rounded-full transition-colors"
                    style={{ background: i === page ? lang.color : 'var(--color-rule)' }}
                  />
                </li>
              ))}
            </ol>
            {isLast ? (
              <button
                type="button"
                onClick={() => setFinished(true)}
                className="h-14 min-w-28 rounded-full bg-ink px-6 font-semibold text-on-ink hover:bg-ink-soft"
              >
                {t('reader.theEnd')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => go(1)}
                className="h-14 min-w-28 rounded-full bg-ink px-6 font-semibold text-on-ink hover:bg-ink-soft"
              >
                {t('reader.next')}
              </button>
            )}
          </nav>
        </>
      )}

      <Tips
        id="reader"
        tips={[
          ...(words.length > 0 ? [{ text: 'tip.tap' as const }] : []),
          { text: 'tip.turn' },
          { text: 'tip.end', ready: isLast },
        ]}
      />

      {(isLast || finished) && words.length > 0 && (
        <BookWords words={words} languages={book.drafts.map((d) => d.language)} />
      )}
    </main>
  )
}
