import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type AnyLanguage, type Book, type StoryPage } from '../lib/api'
import { languageDisplay } from '../lib/languages'

export function ReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [book, setBook] = useState<Book | null>(null)
  const [titles, setTitles] = useState<string[]>([])
  const [pages, setPages] = useState<StoryPage[][]>([])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<'save' | 'publish' | 'fix' | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  function load(b: Book) {
    setBook(b)
    setTitles(b.drafts.map((d) => d.title))
    setPages(b.drafts.map((d) => d.pages.map((p) => ({ ...p }))))
    setDirty(false)
  }

  useEffect(() => {
    api
      .getBook(id!)
      .then(load)
      .catch((e: Error) => setMessage({ kind: 'error', text: e.message }))
  }, [id])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (!book) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-ink-soft">{message ? message.text : 'Opening the book…'}</main>
    )
  }

  async function save(): Promise<Book | null> {
    setBusy('save')
    try {
      const saved = await api.editBook(book!.id, { titles, pages })
      load(saved)
      setMessage({ kind: 'ok', text: 'Changes saved.' })
      return saved
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message })
      return null
    } finally {
      setBusy(null)
    }
  }

  async function publish() {
    if (dirty && !(await save())) return
    setBusy('publish')
    try {
      await api.publishBook(book!.id)
      navigate(`/books/${book!.id}`)
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message })
      setBusy(null)
    }
  }

  async function fixWord(fix: { language: AnyLanguage; wrong: string; right_text: string; note: string }) {
    if (dirty && !(await save())) return false
    setBusy('fix')
    try {
      const updated = await api.addCorrection({ ...fix, note: fix.note || null, book_id: book!.id })
      load(updated)
      setMessage({ kind: 'ok', text: `Fixed “${fix.wrong}” everywhere. Future books will use “${fix.right_text}”.` })
      return true
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message })
      return false
    } finally {
      setBusy(null)
    }
  }

  const languages = book.drafts.map((d) => d.language)
  const published = book.status === 'published'

  return (
    <main className="mx-auto max-w-3xl px-4 pt-8 pb-40 sm:px-6 sm:pt-12">
      <Link to="/my-books" className="text-sm text-ink-soft underline-offset-4 hover:underline">
        My books
      </Link>
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">
        Review the book
      </h1>
      <p className="mt-2 text-ink-soft">
        Read every page as a parent would read it aloud. Fix anything that sounds wrong, then approve it for the library.
      </p>

      {book.review_notes.length > 0 && (
        <section className="mt-8 rounded-2xl bg-turmeric-soft p-5">
          <h2 className="font-semibold">Notes from the reading-level checker</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {book.review_notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}

      <FixWord languages={languages} busy={busy === 'fix'} onFix={fixWord} />

      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold">Title</h2>
        {book.drafts.map((d, i) => (
          <StoryField
            key={d.language}
            language={d.language}
            value={titles[i]}
            label={`Title, ${languageDisplay(d.language).name}`}
            onChange={(v) => {
              setTitles((t) => t.map((x, j) => (j === i ? v : x)))
              setDirty(true)
              setMessage(null)
            }}
            single
          />
        ))}
      </section>

      <ol className="mt-10 space-y-8">
        {book.plan.pages.map((planPage, pageIndex) => (
          <li key={planPage.number} className="overflow-hidden rounded-3xl border border-rule bg-sheet">
            <div className="flex items-center gap-4 border-b border-rule px-5 py-3">
              {book.images?.[String(planPage.number)] && (
                <img
                  src={book.images?.[String(planPage.number)]}
                  alt={planPage.scene}
                  loading="lazy"
                  className="h-16 w-20 shrink-0 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0">
                <h3 className="font-semibold">Page {planPage.number}</h3>
                <p className="line-clamp-2 text-sm text-ink-faint">Picture: {planPage.scene}</p>
              </div>
            </div>
            <div className="space-y-3 p-4">
              {book.drafts.map((d, draftIndex) => (
                <StoryField
                  key={d.language}
                  language={d.language}
                  label={`Page ${planPage.number}, ${languageDisplay(d.language).name}`}
                  value={pages[draftIndex]?.[pageIndex]?.text ?? ''}
                  onChange={(text) => {
                    setPages((all) =>
                      all.map((draftPages, di) =>
                        di === draftIndex ? draftPages.map((p, pi) => (pi === pageIndex ? { ...p, text } : p)) : draftPages,
                      ),
                    )
                    setDirty(true)
                    setMessage(null)
                  }}
                />
              ))}
              {(book.words?.[String(planPage.number)] ?? []).length > 0 && (
                <div className="pt-1">
                  <p className="text-sm text-ink-soft">Words to tap in the picture (use Fix a word to change one)</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {book.words![String(planPage.number)].map((w, i) => (
                      <li key={`${w.english}-${i}`} className="rounded-full bg-paper px-3 py-1 text-sm ring-1 ring-rule">
                        {book.drafts.map((d) => (
                          <span
                            key={d.language}
                            lang={d.language}
                            className="mr-1.5 font-medium"
                            style={{ fontFamily: languageDisplay(d.language).storyFont }}
                          >
                            {w.words[d.language]}
                          </span>
                        ))}
                        <span className="text-ink-faint">{w.english}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <p className="mr-auto min-w-0 text-sm" role="status">
            {message ? (
              <span className={message.kind === 'error' ? 'font-medium text-margin' : 'text-ink-soft'}>{message.text}</span>
            ) : dirty ? (
              <span className="text-ink-soft">Unsaved changes</span>
            ) : published ? (
              <span className="text-ink-soft">Published in the library</span>
            ) : (
              <span className="text-ink-soft">Draft: only you can see it</span>
            )}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || busy !== null}
            className="h-12 rounded-full border-2 border-ink px-5 font-semibold disabled:border-rule disabled:text-ink-faint"
          >
            {busy === 'save' ? 'Saving…' : 'Save changes'}
          </button>
          {!published && (
            <button
              type="button"
              onClick={publish}
              disabled={busy !== null}
              className="h-12 rounded-full bg-ink px-5 font-semibold text-white hover:bg-ink-soft disabled:opacity-60"
            >
              {busy === 'publish' ? 'Publishing…' : 'Approve and publish'}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}

function StoryField({
  language,
  label,
  value,
  onChange,
  single,
}: {
  language: AnyLanguage
  label: string
  value: string
  onChange: (v: string) => void
  single?: boolean
}) {
  const display = languageDisplay(language)
  const common = {
    lang: language,
    value,
    'aria-label': label,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    style: { fontFamily: display.storyFont },
    className:
      'w-full rounded-xl border-2 border-rule bg-sheet px-3 py-2 text-xl leading-relaxed focus:border-ink focus:outline-none',
  }
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium" style={{ color: display.color }}>
        {display.name}
      </span>
      {single ? <input {...common} /> : <textarea {...common} rows={2} className={`${common.className} resize-y`} />}
    </label>
  )
}

function FixWord({
  languages,
  busy,
  onFix,
}: {
  languages: AnyLanguage[]
  busy: boolean
  onFix: (fix: { language: AnyLanguage; wrong: string; right_text: string; note: string }) => Promise<boolean>
}) {
  const [language, setLanguage] = useState<AnyLanguage>(languages[0])
  const [wrong, setWrong] = useState('')
  const [right, setRight] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const display = languageDisplay(language)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!wrong.trim() || !right.trim()) return setError('Enter the wrong word and the right word.')
    if (wrong.trim() === right.trim()) return setError('The right word is the same as the wrong word.')
    setError(null)
    if (await onFix({ language, wrong: wrong.trim(), right_text: right.trim(), note: note.trim() })) {
      setWrong('')
      setRight('')
      setNote('')
    }
  }

  const input =
    'h-12 w-full rounded-xl border-2 border-rule bg-sheet px-3 text-lg focus:border-ink focus:outline-none'

  return (
    <section className="mt-8 rounded-2xl border-2 border-rule p-5">
      <h2 className="text-lg font-semibold">Fix a word</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Fixes the word on every page and teaches the writer, so future books get it right too.
      </p>
      <form onSubmit={submit} noValidate className="mt-4 space-y-3">
        {languages.length > 1 && (
          <div className="flex gap-2" role="radiogroup" aria-label="Language">
            {languages.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={language === l}
                onClick={() => setLanguage(l)}
                className={`h-10 rounded-full border-2 px-4 text-sm font-medium ${
                  language === l ? 'border-ink bg-ink text-white' : 'border-rule'
                }`}
              >
                {languageDisplay(l).name}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Wrong word
            <input lang={language} value={wrong} onChange={(e) => setWrong(e.target.value)} className={`mt-1 ${input}`} style={{ fontFamily: display.storyFont }} />
          </label>
          <label className="block text-sm font-medium">
            Right word
            <input lang={language} value={right} onChange={(e) => setRight(e.target.value)} className={`mt-1 ${input}`} style={{ fontFamily: display.storyFont }} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Why (optional)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Pinky is a girl, so the verb is feminine"
            className="mt-1 h-11 w-full rounded-xl border-2 border-rule bg-sheet px-3 text-sm placeholder:text-ink-faint focus:border-ink focus:outline-none"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm font-medium text-margin">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="h-11 rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-ink-soft disabled:opacity-60"
        >
          {busy ? 'Fixing…' : 'Fix everywhere'}
        </button>
      </form>
    </section>
  )
}
