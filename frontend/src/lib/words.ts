import type { AnyLanguage, Book, TapWord } from './api'

export interface BookWord extends TapWord {
  /** The picture the word was found in. */
  image: string
}

/** Every tap word in the book once, in page order, each with the picture it came from. */
export function bookWords(book: Book): BookWord[] {
  const main: AnyLanguage = book.drafts[0].language
  const seen = new Set<string>()
  const words: BookWord[] = []
  for (const page of book.plan.pages) {
    const image = book.images?.[String(page.number)]
    for (const w of book.words?.[String(page.number)] ?? []) {
      const key = w.words[main] ?? w.english
      if (!image || seen.has(key)) continue
      seen.add(key)
      words.push({ ...w, image })
    }
  }
  return words
}
