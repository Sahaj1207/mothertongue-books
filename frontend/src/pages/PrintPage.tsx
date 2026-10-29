import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { WordThumb } from '../components/WordThumb'
import { api, type AnyLanguage, type Book } from '../lib/api'
import { LANGUAGES, languageDisplay, READING_LEVELS } from '../lib/languages'
import { bookWords } from '../lib/words'

const font = (lang: AnyLanguage) => ({
  fontFamily: languageDisplay(lang).storyFont,
})

/**
 * The book laid out one page per A4 sheet, for the browser's "Save as PDF".
 * The browser shapes Telugu, Kannada and Marathi correctly; PDF libraries in JavaScript don't.
 */
export function PrintPage() {
  const { id } = useParams()
  const [book, setBook] = useState<Book | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getBook(id!)
      .then(setBook)
      .catch((e: Error) => setError(e.message))
  }, [id])

  useEffect(() => {
    if (!book) return
    // The PDF is named after the page title.
    const previous = document.title
    document.title = `${book.drafts[0].title} - MotherTongue Books`
    return () => {
      document.title = previous
    }
  }, [book])

  if (error) return <p className="p-8">{error}</p>
  if (!book) return <p className="p-8 text-ink-soft">Getting the book ready…</p>

  const [main, second] = book.drafts
  const lang = LANGUAGES[book.request.language]
  const level = READING_LEVELS.find((l) => l.id === book.request.level)!
  const cover = book.images?.[String(main.pages[0]?.number)]
  const words = bookWords(book)
  const folk = book.request.kind === 'folk-tale'

  return (
    <div className="min-h-screen bg-paper py-6 print:bg-white print:p-0">
      <div className="mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center gap-3 px-4 print:hidden">
        <Link to={`/books/${book.id}`} className="text-sm text-ink-soft underline-offset-4 hover:underline">
          Back to the book
        </Link>
        <p className="mr-auto text-sm text-ink-faint">In the print window, choose “Save as PDF”.</p>
        <button
          type="button"
          onClick={() => window.print()}
          className="h-12 rounded-full bg-ink px-6 font-semibold text-on-ink hover:bg-ink-soft"
        >
          Save as PDF
        </button>
      </div>

      <section className="sheet items-center justify-between text-center">
        <div>
          <h1
            lang={main.language}
            className="text-[7cqw] leading-tight font-semibold"
            style={{ ...font(main.language), color: lang.color }}
          >
            {main.title}
          </h1>
          {second && (
            <p lang={second.language} className="mt-[1cqw] text-[3.6cqw] text-ink-soft" style={font(second.language)}>
              {second.title}
            </p>
          )}
        </div>
        {cover && <img src={cover} alt="" className="w-[78%] rounded-[3cqw]" />}
        <div className="text-[2.2cqw] text-ink-soft">
          <p>
            {folk
              ? `A traditional tale retold${book.request.source ? `, from ${book.request.source}` : ''}`
              : 'An original story'}{' '}
            · ages {level.ages}
          </p>
          <p className="mt-[0.8cqw] text-ink-faint">
            MotherTongue Books · Story and pictures made with AI
            {book.status === 'published' ? ', reviewed by a parent before publishing' : ' (draft, not yet reviewed)'}
          </p>
        </div>
      </section>

      {main.pages.map((page, i) => {
        const image = book.images?.[String(page.number)]
        return (
          <section key={page.number} className="sheet items-center">
            {image && <img src={image} alt="" className="w-[86%] rounded-[2.5cqw]" />}
            <div className="mt-[5cqw] w-full flex-1">
              <p lang={main.language} className="text-[4.6cqw] leading-[1.6] font-medium" style={font(main.language)}>
                {page.text}
              </p>
              {second && (
                <p
                  lang={second.language}
                  className="mt-[2.5cqw] text-[3.2cqw] leading-[1.6] text-ink-soft"
                  style={font(second.language)}
                >
                  {second.pages[i]?.text}
                </p>
              )}
            </div>
            <p className="text-[2cqw] text-ink-faint">{i + 1}</p>
          </section>
        )
      })}

      {words.length > 0 && (
        <section className="sheet">
          <h2 className="text-[4.4cqw] font-semibold" style={{ color: lang.color }}>
            Words in this book
          </h2>
          <ul className="mt-[4cqw] grid grid-cols-4 gap-[3cqw]">
            {words.slice(0, 16).map((w) => (
              <li key={w.english} className="text-center">
                <WordThumb image={w.image} box={w.box} className="w-full rounded-[2cqw]" />
                <p
                  lang={main.language}
                  className="mt-[1cqw] text-[3.2cqw] leading-tight font-semibold"
                  style={font(main.language)}
                >
                  {w.words[main.language]}
                </p>
                {second && w.words[second.language] && (
                  <p lang={second.language} className="text-[2.2cqw] text-ink-soft" style={font(second.language)}>
                    {w.words[second.language]}
                  </p>
                )}
                <p className="text-[1.9cqw] text-ink-faint">{w.english}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
