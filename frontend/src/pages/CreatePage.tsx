import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LanguageTile } from '../components/LanguageTile'
import { api, type AnyLanguage } from '../lib/api'
import { LANGUAGE_ORDER, LANGUAGES, READING_LEVELS, type LanguageCode, type ReadingLevel } from '../lib/languages'
import type { BookKind } from '../lib/types'

const LEVEL_HINT: Record<ReadingLevel, string> = {
  1: 'One short sentence on each page, lots of repeating words.',
  2: 'One or two short sentences on each page, everyday words.',
  3: 'Two or three sentences on each page, a little talking.',
}

const TOPIC_IDEAS = [
  'Helping grandmother at the vegetable market',
  'A rainy day when the school bus is late',
  'Sharing mangoes with a new friend',
  'Flying a kite on Sankranti',
]

const PAIR_NAMES: Record<AnyLanguage, string> = { te: 'Telugu', kn: 'Kannada', mr: 'Marathi', en: 'English' }

export function CreatePage() {
  const navigate = useNavigate()
  const [kind, setKind] = useState<Extract<BookKind, 'original' | 'two-language'>>('original')
  const [language, setLanguage] = useState<LanguageCode | null>(null)
  const [pair, setPair] = useState<AnyLanguage>('en')
  const [level, setLevel] = useState<ReadingLevel | null>(null)
  const [topic, setTopic] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const clearError = (field: string) =>
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== field)))

  const pairOptions = (['en', ...LANGUAGE_ORDER] as AnyLanguage[]).filter((l) => l !== language)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const found: Record<string, string> = {}
    if (!language) found.language = 'Choose the language the book is written in.'
    if (!level) found.level = "Choose the reader's age."
    if (topic.trim().length < 3) found.topic = 'Write a few words about the story.'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      const job = await api.createBook({
        language: language!,
        level: level!,
        kind,
        pair_language: kind === 'two-language' ? pair : null,
        topic: topic.trim(),
      })
      navigate(`/making/${job.id}`)
    } catch (err) {
      setErrors({ form: (err as Error).message })
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
      <h1 className="mt-8 font-[family-name:var(--font-display)] text-3xl font-semibold sm:mt-12 sm:text-4xl">
        Create a book
      </h1>
      <p className="mt-2 text-ink-soft">
        Agents plan the story, write it in the language and check it before you see it. It takes about a minute.
      </p>

      <form onSubmit={submit} noValidate className="mt-8 space-y-10">
        <fieldset>
          <legend className="mb-3 text-lg font-semibold">What kind of book?</legend>
          <div className="grid grid-cols-2 gap-3" role="radiogroup">
            {(
              [
                ['original', 'One language', 'A new story in one language.'],
                ['two-language', 'Two languages', 'The same story side by side, page by page.'],
              ] as const
            ).map(([value, title, hint]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={kind === value}
                onClick={() => setKind(value)}
                className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                  kind === value ? 'border-ink bg-ink text-white' : 'border-rule bg-sheet hover:border-ink-faint'
                }`}
              >
                <span className="block font-semibold">{title}</span>
                <span className={`mt-1 block text-sm ${kind === value ? 'text-white/80' : 'text-ink-soft'}`}>{hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset aria-describedby={errors.language ? 'language-error' : undefined}>
          <legend className="mb-3 text-lg font-semibold">
            {kind === 'two-language' ? 'Main language' : 'Which language?'}
          </legend>
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4" role="radiogroup">
            {LANGUAGE_ORDER.map((code) => (
              <LanguageTile
                key={code}
                code={code}
                role="radio"
                selected={language === code}
                onSelect={() => {
                  setLanguage(code)
                  if (pair === code) setPair('en')
                  clearError('language')
                }}
                sublabel={LANGUAGES[code].name}
              />
            ))}
          </div>
          {errors.language && <FieldError id="language-error">{errors.language}</FieldError>}
        </fieldset>

        {kind === 'two-language' && (
          <fieldset>
            <legend className="mb-3 text-lg font-semibold">Second language</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {pairOptions.map((code) => (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={pair === code}
                  onClick={() => setPair(code)}
                  className={`h-11 rounded-full border-2 px-5 text-sm font-medium transition-colors ${
                    pair === code ? 'border-ink bg-ink text-white' : 'border-rule bg-sheet hover:border-ink-faint'
                  }`}
                >
                  {PAIR_NAMES[code]}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset aria-describedby={errors.level ? 'level-error' : undefined}>
          <legend className="mb-3 text-lg font-semibold">How old is the reader?</legend>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
            {READING_LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={level === l.id}
                onClick={() => {
                  setLevel(l.id)
                  clearError('level')
                }}
                className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                  level === l.id ? 'border-ink bg-ink text-white' : 'border-rule bg-sheet hover:border-ink-faint'
                }`}
              >
                <span className="block text-xl font-semibold">Ages {l.ages}</span>
                <span className={`mt-1 block text-sm ${level === l.id ? 'text-white/80' : 'text-ink-soft'}`}>
                  {LEVEL_HINT[l.id]}
                </span>
              </button>
            ))}
          </div>
          {errors.level && <FieldError id="level-error">{errors.level}</FieldError>}
        </fieldset>

        <div>
          <label htmlFor="topic" className="mb-3 block text-lg font-semibold">
            What is the story about?
          </label>
          <textarea
            id="topic"
            rows={3}
            maxLength={200}
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value)
              if (errors.topic) clearError('topic')
            }}
            aria-invalid={Boolean(errors.topic)}
            aria-describedby={errors.topic ? 'topic-error' : 'topic-hint'}
            placeholder="A girl who helps her grandmother sell flowers"
            className="notebook w-full resize-none rounded-2xl border-2 border-rule py-[0.55rem] pr-4 pl-14 text-lg leading-[2.25rem] placeholder:text-ink-faint focus:border-ink focus:outline-none"
          />
          {errors.topic ? (
            <FieldError id="topic-error">{errors.topic}</FieldError>
          ) : (
            <p id="topic-hint" className="mt-2 text-sm text-ink-faint">
              Write in English or any language. Names, places and festivals are welcome.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {TOPIC_IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => {
                  setTopic(idea)
                  clearError('topic')
                }}
                className="rounded-full bg-turmeric-soft px-3.5 py-2 text-left text-sm text-ink transition-colors hover:bg-turmeric/40"
              >
                {idea}
              </button>
            ))}
          </div>
        </div>

        {errors.form && (
          <p role="alert" className="rounded-xl border-2 border-margin/40 bg-sheet px-4 py-3">
            {errors.form}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="h-14 w-full rounded-full bg-ink text-lg font-semibold text-white transition-colors hover:bg-ink-soft disabled:opacity-60 sm:w-auto sm:px-10"
        >
          {submitting ? 'Starting…' : 'Make the book'}
        </button>
      </form>
    </main>
  )
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-2 text-sm font-medium text-margin">
      {children}
    </p>
  )
}
