import type { BookSummary } from '../lib/types'

// Placeholder shelf for building the library before the generation pipeline exists.
// Replaced by books from the API; titles still need a native-speaker check.
export const SAMPLE_BOOKS: BookSummary[] = [
  {
    id: 'sample-te-1',
    language: 'te',
    title: 'మామిడి చెట్టు',
    titleEn: 'The mango tree',
    level: 1,
    kind: 'original',
    pageCount: 8,
  },
  {
    id: 'sample-kn-1',
    language: 'kn',
    title: 'ಜಾಣ ಮೊಲ',
    titleEn: 'The clever rabbit',
    level: 2,
    kind: 'folk-tale',
    source: 'Panchatantra',
    pageCount: 10,
  },
  {
    id: 'sample-mr-1',
    language: 'mr',
    title: 'चिमणीचं घरटं',
    titleEn: "The sparrow's nest",
    level: 1,
    kind: 'original',
    pageCount: 8,
  },
  {
    id: 'sample-te-2',
    language: 'te',
    title: 'కోతి మరియు మొసలి',
    titleEn: 'The monkey and the crocodile',
    level: 3,
    kind: 'folk-tale',
    source: 'Panchatantra',
    pageCount: 12,
  },
  {
    id: 'sample-mr-2',
    language: 'mr',
    pairLanguage: 'en',
    title: 'पावसाची गाणी',
    titleEn: 'Songs of the rain',
    level: 2,
    kind: 'two-language',
    pageCount: 10,
  },
  {
    id: 'sample-kn-2',
    language: 'kn',
    title: 'ಅಜ್ಜಿಯ ಗಾಳಿಪಟ',
    titleEn: "Grandmother's kite",
    level: 2,
    kind: 'original',
    pageCount: 10,
  },
]
