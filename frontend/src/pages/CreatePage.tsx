import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LanguageTile } from '../components/LanguageTile'
import { api, type AnyLanguage, type FolkOutline } from '../lib/api'
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

const PAIR_NAMES: Record<AnyLanguage, string> = {
  te: 'Telugu',
  kn: 'Kannada',
  mr: 'Marathi',
  en: 'English',
}

const TALE_IDEAS: Record<LanguageCode, string[]> = {
  kn: ['Punyakoti, the truthful cow', 'The monkey and the crocodile', 'The lion and the clever rabbit'],
  te: ['Tenali Rama and the thieves', 'The monkey and the crocodile', 'The thirsty crow'],
  mr: ['Chiu and Kau, the sparrow and the crow', 'The thirsty crow', 'Birbal and the khichdi'],
}

const KINDS = [
  ['original', 'One language', 'A new story in one language.'],
  ['two-language', 'Two languages', 'The same story side by side, page by page.'],
  ['folk-tale', 'Folk tale', 'A traditional tale, retold for young children.'],
] as const

export function CreatePage() {
  const navigate = useNavigate()
  const [kind, setKind] = useState<BookKind>('original')
  const [language, setLanguage] = useState<LanguageCode | null>(null)
  const [pair, setPair] = useState<AnyLanguage>('en')
  // Folk tales may be in one language or two.
  const [folkPair, setFolkPair] = useState<AnyLanguage | null>(null)
  const [tale, setTale] = useState('')
  const [outline, setOutline] = useState<FolkOutline | null>(null)
  const [steps, setSteps] = useState<string | null>(null)
  const [source, setSource] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [level, setLevel] = useState<ReadingLevel | null>(null)
  const [topic, setTopic] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const clearError = (field: string) =>
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== field)))

  const pairOptions = (['en', ...LANGUAGE_ORDER] as AnyLanguage[]).filter((l) => l !== language)

  const folk = kind === 'folk-tale'
  const secondLanguage = kind === 'two-language' ? pair : folk ? folkPair : null

  async function lookUp() {
    const found: Record<string, string> = {}
    if (!language) found.language = 'Choose the language first, so the tale fits it.'
    if (tale.trim().length < 3) found.tale = 'Write the name of the tale.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setLookingUp(true)
    try {
      const result = await api.folkOutline(tale.trim(), language!)
      setOutline(result)
      setSteps(result.known ? result.beats.join('\n') : '')
      setSource(result.known ? result.source : '')
    } catch (err) {
      setErrors({ tale: (err as Error).message })
    } finally {
      setLookingUp(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const found: Record<string, string> = {}
    if (!language) found.language = 'Choose the language the book is written in.'
    if (!level) found.level = "Choose the reader's age."
    if (folk) {
      if (tale.trim().length < 3) found.tale = 'Write the name of the tale.'
      else if ((steps ?? '').trim().length < 40) found.steps = 'Write the steps of the tale, one per line.'
    } else if (topic.trim().length < 3) found.topic = 'Write a few words about the story.'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      const job = await api.createBook({
        language: language!,
        level: level!,
        kind,
        pair_language: secondLanguage,
        topic: folk ? tale.trim() : topic.trim(),
        ...(folk && { outline: steps!.trim(), source: source.trim() || null }),
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
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
            {KINDS.map(([value, title, hint]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={kind === value}
                onClick={() => setKind(value)}
                className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                  kind === value ? 'border-ink bg-ink text-on-ink' : 'border-rule bg-sheet hover:border-ink-faint'
                }`}
              >
                <span className="block font-semibold">{title}</span>
                <span className={`mt-1 block text-sm ${kind === value ? 'text-on-ink/80' : 'text-ink-soft'}`}>
                  {hint}
                </span>
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
                  if (folkPair === code) setFolkPair(null)
                  clearError('language')
                }}
                sublabel={LANGUAGES[code].name}
              />
            ))}
          </div>
          {errors.language && <FieldError id="language-error">{errors.language}</FieldError>}
        </fieldset>

        {(kind === 'two-language' || folk) && (
          <fieldset>
            <legend className="mb-3 text-lg font-semibold">
              {folk ? 'Add a second language?' : 'Second language'}
            </legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {[...(folk ? [null] : []), ...pairOptions].map((code) => {
                const checked = secondLanguage === code
                return (
                  <button
                    key={code ?? 'none'}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => (folk ? setFolkPair(code) : setPair(code!))}
                    className={`h-11 rounded-full border-2 px-5 text-sm font-medium transition-colors ${
                      checked ? 'border-ink bg-ink text-on-ink' : 'border-rule bg-sheet hover:border-ink-faint'
                    }`}
                  >
                    {code ? PAIR_NAMES[code] : 'No, one language'}
                  </button>
                )
              })}
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
                  level === l.id ? 'border-ink bg-ink text-on-ink' : 'border-rule bg-sheet hover:border-ink-faint'
                }`}
              >
                <span className="block text-xl font-semibold">Ages {l.ages}</span>
                <span className={`mt-1 block text-sm ${level === l.id ? 'text-on-ink/80' : 'text-ink-soft'}`}>
                  {LEVEL_HINT[l.id]}
                </span>
              </button>
            ))}
          </div>
          {errors.level && <FieldError id="level-error">{errors.level}</FieldError>}
        </fieldset>

        {folk ? (
          <FolkTaleFields
            language={language}
            tale={tale}
            onTale={(t) => {
              setTale(t)
              clearError('tale')
            }}
            outline={outline}
            steps={steps}
            onSteps={(t) => {
              setSteps(t)
              clearError('steps')
            }}
            source={source}
            onSource={setSource}
            lookingUp={lookingUp}
            onLookUp={lookUp}
            errors={errors}
          />
        ) : (
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
                Write in English or any language. Places and festivals are welcome; please don't include a real child's
                name or personal details.
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
        )}

        {errors.form && (
          <p role="alert" className="rounded-xl border-2 border-margin/40 bg-sheet px-4 py-3">
            {errors.form}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="h-14 w-full rounded-full bg-ink text-lg font-semibold text-on-ink transition-colors hover:bg-ink-soft disabled:opacity-60 sm:w-auto sm:px-10"
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

interface FolkProps {
  language: LanguageCode | null
  tale: string
  onTale: (tale: string) => void
  outline: FolkOutline | null
  steps: string | null
  onSteps: (steps: string) => void
  source: string
  onSource: (source: string) => void
  lookingUp: boolean
  onLookUp: () => void
  errors: Record<string, string>
}

function FolkTaleFields(p: FolkProps) {
  const ideas = p.language ? TALE_IDEAS[p.language] : TALE_IDEAS.kn
  return (
    <div className="space-y-8">
      <div>
        <label htmlFor="tale" className="mb-3 block text-lg font-semibold">
          Which tale?
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="tale"
            value={p.tale}
            maxLength={120}
            onChange={(e) => p.onTale(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                p.onLookUp()
              }
            }}
            aria-invalid={Boolean(p.errors.tale)}
            aria-describedby={p.errors.tale ? 'tale-error' : 'tale-hint'}
            placeholder="Punyakoti, the truthful cow"
            className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-rule bg-sheet px-4 text-lg placeholder:text-ink-faint focus:border-ink focus:outline-none"
          />
          <button
            type="button"
            onClick={p.onLookUp}
            disabled={p.lookingUp}
            className="h-14 shrink-0 rounded-full border-2 border-ink px-6 font-semibold transition-colors hover:bg-ink hover:text-on-ink disabled:opacity-60"
          >
            {p.lookingUp ? 'Looking it up…' : p.outline ? 'Look up again' : 'Get the story steps'}
          </button>
        </div>
        {p.errors.tale ? (
          <FieldError id="tale-error">{p.errors.tale}</FieldError>
        ) : (
          <p id="tale-hint" className="mt-2 text-sm text-ink-faint">
            Muse Spark writes down how the tale goes. You check it against the tale you know before the book is made.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {ideas.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => p.onTale(idea)}
              className="rounded-full bg-turmeric-soft px-3.5 py-2 text-left text-sm text-ink transition-colors hover:bg-turmeric/40"
            >
              {idea}
            </button>
          ))}
        </div>
      </div>

      {p.steps === null ? (
        <button
          type="button"
          onClick={() => p.onSteps('')}
          className="text-sm font-medium text-ink-soft underline underline-offset-4 hover:text-ink"
        >
          I'll write the steps myself
        </button>
      ) : (
        <div className="space-y-5">
          {p.outline && (
            <p
              role="status"
              className={`rounded-2xl px-4 py-3 text-sm ${p.outline.known ? 'bg-sheet ring-1 ring-rule' : 'bg-turmeric-soft'}`}
            >
              {p.outline.known ? (
                <>
                  <span className="font-semibold">Made gentle for children: </span>
                  {p.outline.notes}
                </>
              ) : (
                <>
                  <span className="font-semibold">
                    Muse Spark doesn't know this tale well enough, so it didn't guess.{' '}
                  </span>
                  Write the steps below as you know them.
                </>
              )}
            </p>
          )}
          <div>
            <label htmlFor="steps" className="mb-1 block text-lg font-semibold">
              How the tale goes
            </label>
            <p id="steps-hint" className="mb-3 text-sm text-ink-faint">
              One step per line; each becomes a page. Change anything that isn't how your family tells it.
            </p>
            <textarea
              id="steps"
              rows={8}
              maxLength={2500}
              value={p.steps}
              onChange={(e) => p.onSteps(e.target.value)}
              aria-invalid={Boolean(p.errors.steps)}
              aria-describedby={p.errors.steps ? 'steps-error steps-hint' : 'steps-hint'}
              placeholder={'A cow named Punyakoti goes to graze.\nA hungry tiger stops her on the way.'}
              className="notebook w-full rounded-2xl border-2 border-rule py-[0.55rem] pr-4 pl-14 text-base leading-[2.25rem] placeholder:text-ink-faint focus:border-ink focus:outline-none"
            />
            {p.errors.steps && <FieldError id="steps-error">{p.errors.steps}</FieldError>}
          </div>
          <div>
            <label htmlFor="source" className="mb-3 block text-lg font-semibold">
              Where does it come from? <span className="font-normal text-ink-faint">(optional)</span>
            </label>
            <input
              id="source"
              value={p.source}
              maxLength={80}
              onChange={(e) => p.onSource(e.target.value)}
              placeholder="Kannada folk song, Panchatantra…"
              className="h-12 w-full rounded-2xl border-2 border-rule bg-sheet px-4 placeholder:text-ink-faint focus:border-ink focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  )
}
