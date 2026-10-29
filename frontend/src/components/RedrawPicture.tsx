import { useEffect, useState } from 'react'
import { api, type Book } from '../lib/api'

interface Props {
  book: Book
  page: number
  /** What the picture checker still saw wrong on this page. */
  notes: string[]
  onRedrawn: (book: Book) => void
}

/** The page's picture problems, and a way to redraw just that picture with the adult's own note. */
export function RedrawPicture({ book, page, notes, onRedrawn }: Props) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) return
    const timer = setInterval(async () => {
      try {
        const job = await api.getJob(jobId)
        if (job.status === 'running') return
        clearInterval(timer)
        setJobId(null)
        if (job.status === 'done') {
          onRedrawn(await api.getBook(book.id))
          setOpen(false)
          setNote('')
        } else {
          setError(job.message ?? 'The picture couldn’t be redrawn.')
        }
      } catch (e) {
        clearInterval(timer)
        setJobId(null)
        setError((e as Error).message)
      }
    }, 2500)
    return () => clearInterval(timer)
  }, [jobId, book.id, onRedrawn])

  async function redraw() {
    setError(null)
    try {
      const job = await api.redrawPage(book.id, page, note.trim() || null)
      setJobId(job.id)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const working = jobId !== null

  return (
    <div className="border-b border-rule px-5 py-3">
      {notes.length > 0 && (
        <div className="mb-3 rounded-xl bg-turmeric-soft px-3.5 py-2.5 text-sm">
          <p className="font-semibold">The picture checker still sees:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      {open ? (
        <div className="space-y-2">
          <label htmlFor={`redraw-${page}`} className="block text-sm font-medium">
            What should change? <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <input
            id={`redraw-${page}`}
            value={note}
            maxLength={300}
            disabled={working}
            onChange={(e) => setNote(e.target.value)}
            placeholder="The calf drinks milk from its mother"
            className="h-11 w-full rounded-xl border-2 border-rule bg-sheet px-3 focus:border-ink focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={redraw}
              disabled={working}
              className="h-10 rounded-full bg-ink px-4 text-sm font-semibold text-on-ink hover:bg-ink-soft disabled:opacity-60"
            >
              {working ? 'Drawing and checking…' : 'Redraw'}
            </button>
            {!working && (
              <button type="button" onClick={() => setOpen(false)} className="h-10 px-3 text-sm text-ink-soft hover:text-ink">
                Cancel
              </button>
            )}
            {working && <span className="text-sm text-ink-faint">About a minute.</span>}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-10 rounded-full border-2 border-rule px-4 text-sm font-medium hover:border-ink"
        >
          Redraw picture
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-margin">
          {error}
        </p>
      )}
    </div>
  )
}
