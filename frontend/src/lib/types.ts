import type { LanguageCode, ReadingLevel } from './languages'

export type BookKind = 'original' | 'two-language' | 'folk-tale'

export interface BookSummary {
  id: string
  language: LanguageCode
  /** Second language, for two-language books. */
  pairLanguage?: LanguageCode | 'en'
  title: string
  /** English title, shown to adults browsing in English. */
  titleEn: string
  level: ReadingLevel
  kind: BookKind
  /** Tradition a folk tale is retold from, e.g. "Panchatantra". */
  source?: string
  pageCount: number
  /** Page 1's picture, used as the cover. */
  coverUrl?: string
  /** When it was published, for the "New" badge. */
  publishedAt?: string
}
