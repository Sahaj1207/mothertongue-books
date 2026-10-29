import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LanguageTile } from '../components/LanguageTile'
import { api, type AnyLanguage, type FolkOutline } from '../lib/api'
import { useT } from '../lib/i18n'
import { LANGUAGE_ORDER, READING_LEVELS, type LanguageCode, type ReadingLevel } from '../lib/languages'
import type { BookKind } from '../lib/types'

const LEVEL_HINT = { 1: 'create.level1', 2: 'create.level2', 3: 'create.level3' } as const satisfies Record<
  ReadingLevel,
  string
>

const TOPIC_IDEAS = ['create.idea1', 'create.idea2', 'create.idea3', 'create.idea4'] as const

const TALE_IDEAS = {
  kn: ['tale.punyakoti', 'tale.monkeyCrocodile', 'tale.lionRabbit'],
  te: ['tale.tenaliThieves', 'tale.monkeyCrocodile', 'tale.thirstyCrow'],
  mr: ['tale.chiuKau', 'tale.thirstyCrow', 'tale.birbalKhichdi'],
} as const satisfies Record<LanguageCode, readonly string[]>

const KINDS = [
  ['original', 'create.kind.original', 'create.kind.original.hint'],
  ['two-language', 'create.kind.two', 'create.kind.two.hint'],
  ['folk-tale', 'create.kind.folk', 'create.kind.folk.hint'],
] as const

export function CreatePage() {
  const navigate = useNavigate()
  const t = useT()
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
    if (!language) found.language = t('create.error.languageFirst')
    if (tale.trim().length < 3) found.tale = t('create.error.tale')
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
    if (!language) found.language = t('create.error.language')
    if (!level) found.level = t('create.error.level')
    if (folk) {
      if (tale.trim().length < 3) found.tale = t('create.error.tale')
      else if ((steps ?? '').trim().length < 40) found.steps = t('create.error.steps')
    } else if (topic.trim().length < 3) found.topic = t('create.error.topic')
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
        {t('create.title')}
      </h1>
      <p className="mt-2 text-ink-soft">
        {t('create.subtitle')}
      </p>

      <form onSubmit={submit} noValidate className="mt-8 space-y-10">
        <fieldset>
          <legend className="mb-3 text-lg font-semibold">{t('create.kind')}</legend>
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
                <span className="block font-semibold">{t(title)}</span>
                <span className={`mt-1 block text-sm ${kind === value ? 'text-on-ink/80' : 'text-ink-soft'}`}>
                  {t(hint)}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset aria-describedby={errors.language ? 'language-error' : undefined}>
          <legend className="mb-3 text-lg font-semibold">
            {kind === 'two-language' ? t('create.mainLanguage') : t('create.whichLanguage')}
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
                sublabel={t(`lang.${code}`)}
              />
            ))}
          </div>
          {errors.language && <FieldError id="language-error">{errors.language}</FieldError>}
        </fieldset>

        {(kind === 'two-language' || folk) && (
          <fieldset>
            <legend className="mb-3 text-lg font-semibold">
              {folk ? t('create.addSecond') : t('create.second')}
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
                    {code ? t(`lang.${code}`) : t('create.oneLanguage')}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        <fieldset aria-describedby={errors.level ? 'level-error' : undefined}>
          <legend className="mb-3 text-lg font-semibold">{t('create.age')}</legend>
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
                <span className="block text-xl font-semibold">{t('common.agesTitle', { ages: l.ages })}</span>
                <span className={`mt-1 block text-sm ${level === l.id ? 'text-on-ink/80' : 'text-ink-soft'}`}>
                  {t(LEVEL_HINT[l.id])}
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
            onTale={(value) => {
              setTale(value)
              clearError('tale')
            }}
            outline={outline}
            steps={steps}
            onSteps={(value) => {
              setSteps(value)
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
              {t('create.topic')}
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
              placeholder={t('create.topicPlaceholder')}
              className="notebook w-full resize-none rounded-2xl border-2 border-rule py-[0.55rem] pr-4 pl-14 text-lg leading-[2.25rem] placeholder:text-ink-faint focus:border-ink focus:outline-none"
            />
            {errors.topic ? (
              <FieldError id="topic-error">{errors.topic}</FieldError>
            ) : (
              <p id="topic-hint" className="mt-2 text-sm text-ink-faint">
                {t('create.topicHint')}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {TOPIC_IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => {
                    setTopic(t(idea))
                    clearError('topic')
                  }}
                  className="rounded-full bg-turmeric-soft px-3.5 py-2 text-left text-sm text-ink transition-colors hover:bg-turmeric/40"
                >
                  {t(idea)}
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
          {submitting ? t('create.starting') : t('create.make')}
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
  const t = useT()
  const ideas = p.language ? TALE_IDEAS[p.language] : TALE_IDEAS.kn
  return (
    <div className="space-y-8">
      <div>
        <label htmlFor="tale" className="mb-3 block text-lg font-semibold">
          {t('folk.which')}
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
            placeholder={t('folk.placeholder')}
            className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-rule bg-sheet px-4 text-lg placeholder:text-ink-faint focus:border-ink focus:outline-none"
          />
          <button
            type="button"
            onClick={p.onLookUp}
            disabled={p.lookingUp}
            className="h-14 shrink-0 rounded-full border-2 border-ink px-6 font-semibold transition-colors hover:bg-ink hover:text-on-ink disabled:opacity-60"
          >
            {p.lookingUp ? t('folk.lookingUp') : p.outline ? t('folk.lookAgain') : t('folk.getSteps')}
          </button>
        </div>
        {p.errors.tale ? (
          <FieldError id="tale-error">{p.errors.tale}</FieldError>
        ) : (
          <p id="tale-hint" className="mt-2 text-sm text-ink-faint">
            {t('folk.hint')}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {ideas.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => p.onTale(t(idea))}
              className="rounded-full bg-turmeric-soft px-3.5 py-2 text-left text-sm text-ink transition-colors hover:bg-turmeric/40"
            >
              {t(idea)}
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
          {t('folk.writeMyself')}
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
                  <span className="font-semibold">{t('folk.gentle')} </span>
                  {p.outline.notes}
                </>
              ) : (
                <>
                  <span className="font-semibold">{t('folk.unknown')} </span>
                  {t('folk.unknownHint')}
                </>
              )}
            </p>
          )}
          <div>
            <label htmlFor="steps" className="mb-1 block text-lg font-semibold">
              {t('folk.steps')}
            </label>
            <p id="steps-hint" className="mb-3 text-sm text-ink-faint">
              {t('folk.stepsHint')}
            </p>
            <textarea
              id="steps"
              rows={8}
              maxLength={2500}
              value={p.steps}
              onChange={(e) => p.onSteps(e.target.value)}
              aria-invalid={Boolean(p.errors.steps)}
              aria-describedby={p.errors.steps ? 'steps-error steps-hint' : 'steps-hint'}
              placeholder={t('folk.stepsPlaceholder')}
              className="notebook w-full rounded-2xl border-2 border-rule py-[0.55rem] pr-4 pl-14 text-base leading-[2.25rem] placeholder:text-ink-faint focus:border-ink focus:outline-none"
            />
            {p.errors.steps && <FieldError id="steps-error">{p.errors.steps}</FieldError>}
          </div>
          <div>
            <label htmlFor="source" className="mb-3 block text-lg font-semibold">
              {t('folk.source')} <span className="font-normal text-ink-faint">{t('common.optional')}</span>
            </label>
            <input
              id="source"
              value={p.source}
              maxLength={80}
              onChange={(e) => p.onSource(e.target.value)}
              placeholder={t('folk.sourcePlaceholder')}
              className="h-12 w-full rounded-2xl border-2 border-rule bg-sheet px-4 placeholder:text-ink-faint focus:border-ink focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  )
}
