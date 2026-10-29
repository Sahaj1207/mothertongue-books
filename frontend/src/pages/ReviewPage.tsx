import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RedrawPicture } from '../components/RedrawPicture'
import { api, type AnyLanguage, type Book, type StoryPage } from '../lib/api'
import { useT } from '../lib/i18n'
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
  const t = useT()

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

  // A redraw changes pictures, words and notes, never the text being edited.
  const onRedrawn = useCallback((b: Book) => setBook(b), [])

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (!book) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-ink-soft">{message ? message.text : t('reader.opening')}</main>
    )
  }

  async function save(): Promise<Book | null> {
    setBusy('save')
    try {
      const saved = await api.editBook(book!.id, { titles, pages })
      load(saved)
      setMessage({ kind: 'ok', text: t('review.saved') })
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
      setMessage({ kind: 'ok', text: t('review.fixed', { wrong: fix.wrong, right: fix.right_text }) })
      return true
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message })
      return false
    } finally {
      setBusy(null)
    }
  }

  const isPictureNote = (n: string) => /^Page \d+ picture: /.test(n)
  const textNotes = book.review_notes.filter((n) => !isPictureNote(n))
  const pictureNotes = (page: number) =>
    book.review_notes.filter((n) => n.startsWith(`Page ${page} picture: `)).map((n) => n.split(': ').slice(1).join(': '))
  const languages = book.drafts.map((d) => d.language)
  const published = book.status === 'published'

  return (
    <main className="mx-auto max-w-3xl px-4 pt-8 pb-40 sm:px-6 sm:pt-12">
      <Link to="/my-books" className="text-sm text-ink-soft underline-offset-4 hover:underline">
        {t('review.myBooks')}
      </Link>
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">
        {t('review.title')}
      </h1>
      <p className="mt-2 text-ink-soft">
        {t('review.subtitle')}
      </p>

      {textNotes.length > 0 && (
        <section className="mt-8 rounded-2xl bg-turmeric-soft p-5">
          <h2 className="font-semibold">{t('review.notes')}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {textNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}

      <FixWord languages={languages} busy={busy === 'fix'} onFix={fixWord} />

      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold">{t('review.bookTitle')}</h2>
        {book.drafts.map((d, i) => (
          <StoryField
            key={d.language}
            language={d.language}
            value={titles[i]}
            label={t('review.titleField', { lang: t(`lang.${d.language}`) })}
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
                <h3 className="font-semibold">{t('review.page', { n: planPage.number })}</h3>
                <p className="line-clamp-2 text-sm text-ink-faint">{t('review.picture', { scene: planPage.scene })}</p>
              </div>
            </div>
            {book.images?.[String(planPage.number)] && (
              <RedrawPicture
                book={book}
                page={planPage.number}
                notes={pictureNotes(planPage.number)}
                onRedrawn={onRedrawn}
              />
            )}
            <div className="space-y-3 p-4">
              {book.drafts.map((d, draftIndex) => (
                <StoryField
                  key={d.language}
                  language={d.language}
                  label={t('review.pageField', { n: planPage.number, lang: t(`lang.${d.language}`) })}
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
                  <p className="text-sm text-ink-soft">{t('review.tapWords')}</p>
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
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <p className="w-full min-w-0 text-xs sm:mr-auto sm:w-auto sm:text-sm" role="status">
            {message ? (
              <span className={message.kind === 'error' ? 'font-medium text-margin' : 'text-ink-soft'}>{message.text}</span>
            ) : dirty ? (
              <span className="text-ink-soft">{t('review.unsaved')}</span>
            ) : published ? (
              <span className="text-ink-soft">{t('review.isPublished')}</span>
            ) : (
              <span className="text-ink-soft">{t('review.isDraft')}</span>
            )}
          </p>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || busy !== null}
            className="h-12 flex-1 rounded-full border-2 border-ink px-4 font-semibold disabled:border-rule disabled:text-ink-faint sm:flex-none sm:px-5"
          >
            {busy === 'save' ? t('review.saving') : t('review.save')}
          </button>
          {!published && (
            <button
              type="button"
              onClick={publish}
              disabled={busy !== null}
              className="h-12 flex-1 rounded-full bg-ink px-4 font-semibold text-on-ink hover:bg-ink-soft disabled:opacity-60 sm:flex-none sm:px-5"
            >
              {busy === 'publish' ? t('review.publishing') : t('review.publish')}
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
  const t = useT()
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
        {t(`lang.${language}`)}
      </span>
      {single ? <input {...common} /> : <textarea {...common} rows={3} className={`${common.className} resize-y [field-sizing:content]`} />}
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
  const t = useT()
  const display = languageDisplay(language)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!wrong.trim() || !right.trim()) return setError(t('fix.error.empty'))
    if (wrong.trim() === right.trim()) return setError(t('fix.error.same'))
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
      <h2 className="text-lg font-semibold">{t('fix.title')}</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {t('fix.subtitle')}
      </p>
      <form onSubmit={submit} noValidate className="mt-4 space-y-3">
        {languages.length > 1 && (
          <div className="flex gap-2" role="radiogroup" aria-label={t('fix.language')}>
            {languages.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={language === l}
                onClick={() => setLanguage(l)}
                className={`h-10 rounded-full border-2 px-4 text-sm font-medium ${
                  language === l ? 'border-ink bg-ink text-on-ink' : 'border-rule'
                }`}
              >
                {t(`lang.${l}`)}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {t('fix.wrong')}
            <input lang={language} value={wrong} onChange={(e) => setWrong(e.target.value)} className={`mt-1 ${input}`} style={{ fontFamily: display.storyFont }} />
          </label>
          <label className="block text-sm font-medium">
            {t('fix.right')}
            <input lang={language} value={right} onChange={(e) => setRight(e.target.value)} className={`mt-1 ${input}`} style={{ fontFamily: display.storyFont }} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          {t('fix.why')}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('fix.whyPlaceholder')}
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
          className="h-11 rounded-full bg-ink px-5 text-sm font-semibold text-on-ink hover:bg-ink-soft disabled:opacity-60"
        >
          {busy ? t('fix.fixing') : t('fix.submit')}
        </button>
      </form>
    </section>
  )
}
