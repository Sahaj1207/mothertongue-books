import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Book } from '../lib/api'
import { RowsSkeleton } from '../components/Skeleton'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/i18n'
import { LANGUAGES } from '../lib/languages'
import { supabase } from '../lib/supabase'
import { usePageTitle } from '../lib/title'

export function MyBooksPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [books, setBooks] = useState<Book[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The book whose delete is waiting for a yes, and what happened to the last delete.
  const [confirming, setConfirming] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const t = useT()
  usePageTitle(t('my.title'))

  useEffect(() => {
    api
      .myBooks()
      .then(setBooks)
      .catch((e: Error) => setError(e.message))
  }, [])

  async function remove(book: Book) {
    setDeleting(true)
    try {
      await api.deleteBook(book.id)
      setBooks((list) => list?.filter((b) => b.id !== book.id) ?? null)
      setNotice(t('my.deleted', { title: book.drafts[0].title }))
      setConfirming(null)
    } catch (e) {
      setNotice((e as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">{t('my.title')}</h1>
          <p className="mt-1 text-sm text-ink-faint">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut()
            navigate('/')
          }}
          className="h-10 rounded-full px-3 text-sm text-ink-soft underline-offset-4 hover:underline"
        >
          {t('nav.signOut')}
        </button>
      </div>

      <p role="status" className="mt-6 min-h-6 text-sm font-medium empty:mt-0 empty:min-h-0">
        {notice}
      </p>

      {error ? (
        <p role="alert" className="mt-8 rounded-2xl border-2 border-margin/40 bg-sheet p-5">
          {error}
        </p>
      ) : books === null ? (
        <RowsSkeleton label={t('my.loading')} />
      ) : books.length === 0 ? (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-rule px-6 py-12 text-center">
          <p className="font-medium">{t('my.empty')}</p>
          <Link
            to="/create"
            className="mt-5 inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-on-ink hover:bg-ink-soft"
          >
            {t('nav.create')}
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-rule overflow-hidden rounded-3xl border border-rule bg-sheet">
          {books.map((book) => {
            const main = book.drafts[0]
            const lang = LANGUAGES[book.request.language]
            const published = book.status === 'published'
            return (
              <li
                key={book.id}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-3 p-4 sm:flex sm:flex-wrap sm:gap-x-4 sm:p-5"
              >
                <span
                  className="weave h-12 w-2 shrink-0 rounded-full"
                  style={{ '--weave-color': lang.color } as React.CSSProperties}
                />
                <div className="min-w-0 flex-1">
                  <p
                    lang={main.language}
                    className="truncate text-xl font-semibold"
                    style={{ fontFamily: lang.storyFont, color: lang.color }}
                  >
                    {main.title}
                  </p>
                  <p className="truncate text-sm text-ink-faint">
                    {[
                      book.plan.title_en,
                      book.drafts.map((d) => t(`lang.${d.language}`)).reduce((a, b) => t('common.pair', { a, b })),
                    ].join(', ')}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    published ? 'bg-kannada-soft text-kannada' : 'bg-turmeric-soft text-ink'
                  }`}
                >
                  {published ? t('my.published') : t('my.draft')}
                </span>
                <div className="col-span-3 flex gap-2 sm:col-span-1">
                  <Link
                    to={`/books/${book.id}`}
                    className="inline-flex h-10 items-center rounded-full border-2 border-rule px-4 text-sm font-medium hover:border-ink"
                  >
                    {t('my.read')}
                  </Link>
                  <Link
                    to={`/books/${book.id}/review`}
                    className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-medium text-on-ink hover:bg-ink-soft"
                  >
                    {published ? t('my.edit') : t('my.review')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(book.id)
                      setNotice(null)
                    }}
                    aria-expanded={confirming === book.id}
                    className="ml-auto inline-flex h-10 items-center rounded-full px-3 text-sm text-ink-soft underline-offset-4 hover:text-ink hover:underline sm:ml-0"
                  >
                    {t('my.delete')}
                  </button>
                </div>
                {confirming === book.id && (
                  <div className="col-span-3 w-full rounded-2xl border-2 border-margin/50 bg-paper p-4 sm:basis-full">
                    <p className="font-medium">{t('my.deleteConfirm', { title: main.title })}</p>
                    {published && <p className="mt-1 text-sm text-ink-soft">{t('my.deletePublished')}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => remove(book)}
                        className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-medium text-on-ink hover:bg-ink-soft disabled:opacity-60"
                      >
                        {deleting ? t('my.deleting') : t('my.deleteYes')}
                      </button>
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => setConfirming(null)}
                        className="inline-flex h-10 items-center rounded-full border-2 border-rule px-4 text-sm font-medium hover:border-ink"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
