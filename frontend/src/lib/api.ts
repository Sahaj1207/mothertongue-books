import { accessToken } from './supabase'
import type { LanguageCode, ReadingLevel } from './languages'
import type { BookKind, BookSummary } from './types'

export type AnyLanguage = LanguageCode | 'en'

export interface BookRequest {
  language: LanguageCode
  pair_language?: AnyLanguage | null
  level: ReadingLevel
  kind: BookKind
  topic: string
  /** Folk tales: the tradition it comes from, and the plot the adult approved. */
  source?: string | null
  outline?: string | null
}

export interface FolkOutline {
  /** What was softened for children, or why the tale isn't known. */
  notes: string
  known: boolean
  title_en: string
  source: string
  beats: string[]
}

export type StepStatus = 'waiting' | 'running' | 'done' | 'failed'

export interface Step {
  key: string
  label: string
  status: StepStatus
  detail: string | null
  /** Model that runs this step, e.g. "Muse Spark" or "Muse Spark Open". */
  model: string | null
}

export interface Job {
  id: string
  status: 'running' | 'done' | 'blocked' | 'failed'
  request: BookRequest
  steps: Step[]
  book_id: string | null
  message: string | null
}

export interface StoryPage {
  number: number
  text: string
}

export interface StoryDraft {
  language: AnyLanguage
  title: string
  pages: StoryPage[]
}

export interface Book {
  id: string
  request: BookRequest
  plan: {
    title_en: string
    setting: string
    lesson: string
    characters: { name: string; description: string }[]
    pages: { number: number; event: string; scene: string }[]
  }
  drafts: StoryDraft[]
  /** Reading-level notes the checker still had, for the adult reviewing the book. */
  review_notes: string[]
  /** Picture URL per page number; pages without a picture are missing. */
  images?: Record<string, string>
  /** Tap-to-learn objects per page number. */
  words?: Record<string, TapWord[]>
  owner_id: string | null
  status: 'draft' | 'published'
  created_at: string
  published_at: string | null
}

export interface TapWord {
  english: string
  words: Partial<Record<AnyLanguage, string>>
  /** Where the object is in the picture, as fractions: x1, y1, x2, y2. */
  box: [number, number, number, number]
}

export interface Correction {
  language: AnyLanguage
  wrong: string
  right_text: string
  note?: string | null
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await accessToken()
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : 'The server rejected the request.'
    throw new ApiError(detail, res.status)
  }
  return res.json()
}

export const api = {
  createBook: (body: BookRequest) => request<Job>('/books', { method: 'POST', body: JSON.stringify(body) }),
  getJob: (id: string) => request<Job>(`/jobs/${id}`),
  getBook: (id: string) => request<Book>(`/books/${id}`),
  listBooks: () => request<Book[]>('/books'),
  myBooks: () => request<Book[]>('/me/books'),
  editBook: (id: string, edits: { titles: string[]; pages: StoryPage[][] }) =>
    request<Book>(`/books/${id}`, { method: 'PUT', body: JSON.stringify(edits) }),
  addCorrection: (fix: Correction & { book_id: string }) =>
    request<Book>('/corrections', { method: 'POST', body: JSON.stringify(fix) }),
  folkOutline: (tale: string, language: LanguageCode) =>
    request<FolkOutline>('/folk-outline', { method: 'POST', body: JSON.stringify({ tale, language }) }),
  publishBook: (id: string) => request<Book>(`/books/${id}/publish`, { method: 'POST' }),
}

export function toSummary(book: Book): BookSummary {
  const main = book.drafts[0]
  return {
    id: book.id,
    language: book.request.language,
    pairLanguage: book.request.pair_language ?? undefined,
    title: main.title,
    titleEn: book.plan.title_en,
    level: book.request.level,
    kind: book.request.kind,
    source: book.request.source ?? undefined,
    pageCount: main.pages.length,
    coverUrl: book.images?.[String(main.pages[0]?.number)],
  }
}
