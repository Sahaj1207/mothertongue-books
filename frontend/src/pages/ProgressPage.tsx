import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StepIcon } from '../components/StepIcon'
import { api, type Job, type Step } from '../lib/api'
import { useT, type Translate } from '../lib/i18n'
import type { MessageKey } from '../locales/en'
import { languageDisplay } from '../lib/languages'
import type { AnyLanguage } from '../lib/api'

const STEP_KEYS = ['topic_check', 'planner', 'writer', 'reading_level', 'safety', 'illustrator', 'tap_words'] as const
type StepKind = (typeof STEP_KEYS)[number]
const stepKind = (step: Step) => step.key.split(':')[0] as StepKind

/** The server reports step details in English; these are the ones it can send. */
const DETAILS: [RegExp, MessageKey][] = [
  [/^Improved after review$/, 'detail.improved'],
  [/^Notes for your review$/, 'detail.notes'],
  [/^Rewriting with reviewer notes \(try (?<n>\d+)\)$/, 'detail.rewriting'],
  [/^Redrawing page (?<n>\d+)$/, 'detail.redrawing'],
  [/^(?<done>\d+) of (?<total>\d+)$/, 'detail.progress'],
  [/^(?<n>\d+) words$/, 'detail.words'],
  [/^No words found$/, 'detail.noWords'],
  [/^(?<n>\d+) pictures missing$/, 'detail.missing'],
  [/^Today's free pictures are used up/, 'detail.usedUp'],
]

function translateDetail(detail: string, t: Translate): string {
  for (const [pattern, key] of DETAILS) {
    const match = pattern.exec(detail)
    if (match) return t(key, match.groups)
  }
  return detail
}

// Steps without a language that run after the story is written.
const PICTURE_STEPS = new Set(['illustrator', 'tap_words'])

const POLL_MS = 1000

export function ProgressPage() {
  const { jobId } = useParams()
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mock, setMock] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [started] = useState(() => Date.now())
  const t = useT()

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((h) => setMock(Boolean(h.mock_ai)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let stop = false
    let timer: number | undefined
    async function poll() {
      try {
        const next = await api.getJob(jobId!)
        if (stop) return
        setJob(next)
        setError(null)
        if (next.status === 'running') timer = window.setTimeout(poll, POLL_MS)
      } catch (e) {
        if (stop) return
        setError((e as Error).message)
        timer = window.setTimeout(poll, POLL_MS * 3)
      }
    }
    poll()
    return () => {
      stop = true
      window.clearTimeout(timer)
    }
  }, [jobId])

  const running = !job || job.status === 'running'
  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(t)
  }, [running, started])

  if (!job) {
    return (
      <Shell>
        <p className="text-ink-soft">{error ?? t('progress.starting')}</p>
      </Shell>
    )
  }

  const [setup, ...rest] = groupSteps(job.steps, t)
  const languages = [job.request.language, job.request.pair_language]
    .filter((l) => l != null)
    .map((l) => t(`lang.${l}`))
    .reduce((a, b) => t('common.pair', { a, b }))

  return (
    <Shell>
      <p className="text-sm text-ink-faint">
        {t('progress.languagesAges', { languages, ages: ['3–5', '5–7', '7–9'][job.request.level - 1] })}
      </p>
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl leading-tight font-semibold sm:text-4xl">
        {job.status === 'done' ? t('progress.ready') : job.status === 'running' ? t('progress.making') : t('progress.notMade')}
      </h1>
      <p className="mt-2 text-lg text-ink-soft">“{job.request.topic}”</p>

      {mock && (
        <p className="mt-4 rounded-xl bg-turmeric-soft px-4 py-3 text-sm">
          {t('progress.practice')}
        </p>
      )}

      <div className="notebook mt-8 rounded-3xl border border-rule py-[2.25rem] pr-4 pl-16 sm:pr-6" aria-live="polite">
        <StepGroup title={t('progress.gettingReady')} steps={setup.steps} />
        {rest.map((g) => (
          <StepGroup
            key={g.lang}
            title={g.title}
            lang={g.lang === 'pictures' ? undefined : (g.lang as AnyLanguage)}
            steps={g.steps}
          />
        ))}
      </div>

      {job.status === 'running' && (
        <p className="mt-4 text-sm text-ink-faint" aria-hidden="true">
          {elapsed}s
        </p>
      )}

      {job.status === 'done' && job.book_id && (
        <Link
          to={`/books/${job.book_id}/review`}
          className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-full bg-ink px-10 text-lg font-semibold text-on-ink hover:bg-ink-soft sm:w-auto"
        >
          {t('progress.review')}
        </Link>
      )}

      {(job.status === 'blocked' || job.status === 'failed') && (
        <div role="alert" className="mt-8 rounded-2xl border-2 border-margin/40 bg-sheet p-5">
          <p className="font-medium">{job.message}</p>
          <Link
            to="/create"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-on-ink hover:bg-ink-soft"
          >
            {job.status === 'blocked' ? t('progress.changeTopic') : t('progress.tryAgain')}
          </Link>
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-2xl px-4 pt-8 pb-24 sm:px-6 sm:pt-12">{children}</main>
}

interface Group {
  lang: string
  title: string
  steps: Step[]
}

function groupSteps(steps: Step[], t: Translate): Group[] {
  const groups: Group[] = [{ lang: 'setup', title: t('progress.gettingReady'), steps: [] }]
  for (const step of steps) {
    if (PICTURE_STEPS.has(step.key)) {
      let pictures = groups.find((g) => g.lang === 'pictures')
      if (!pictures) groups.push((pictures = { lang: 'pictures', title: t('progress.pictures'), steps: [] }))
      pictures.steps.push(step)
      continue
    }
    const [, lang] = step.key.split(':')
    if (!lang) {
      groups[0].steps.push(step)
      continue
    }
    let group = groups.find((g) => g.lang === lang)
    if (!group) {
      group = { lang, title: t(`lang.${lang as AnyLanguage}`), steps: [] }
      groups.push(group)
    }
    group.steps.push(step)
  }
  return groups
}

function StepGroup({ title, steps, lang }: { title: string; steps: Step[]; lang?: AnyLanguage }) {
  const display = lang ? languageDisplay(lang) : null
  const color = display?.color
  return (
    <section className="[&+&]:mt-[2.25rem]">
      <h2 className="flex h-[2.25rem] items-center gap-2 text-sm font-semibold" style={{ color }}>
        {display && lang !== 'en' && (
          <span lang={lang} className="text-lg leading-none" style={{ fontFamily: display.storyFont }}>
            {display.nativeName}
          </span>
        )}
        <span className={display && lang !== 'en' ? 'text-ink-faint' : 'text-ink-soft'}>{title}</span>
      </h2>
      <ol>
        {steps.map((step) => (
          <StepRow key={step.key} step={step} />
        ))}
      </ol>
    </section>
  )
}

function StepRow({ step }: { step: Step }) {
  const t = useT()
  const kind = stepKind(step)
  // The reading-level check is advisory: notes for the adult aren't a failure.
  const notes = step.status === 'failed' && step.detail === 'Notes for your review'
  return (
    // Rows wrap rather than cut words off; each line stays on the notebook's ruled lines.
    <li className="flex flex-wrap items-center gap-x-3">
      <span className="flex min-h-[2.25rem] min-w-0 flex-[1_1_auto] items-center gap-3">
        <StepIcon status={notes ? 'notes' : step.status} />
        <span className={`relative min-w-0 leading-snug ${step.status === 'waiting' ? 'text-ink-faint' : ''}`}>
          {STEP_KEYS.includes(kind) ? t(`step.${kind}`) : step.label}
          <span className="sr-only">: {notes ? t('detail.notes') : t(`status.${step.status}`)}</span>
        </span>
      </span>
      {step.detail ? (
        <span className="flex h-[2.25rem] items-center pl-9 sm:pl-0">
          <span className="rounded-full bg-turmeric-soft px-2.5 py-0.5 text-xs whitespace-nowrap">
            {translateDetail(step.detail, t)}
          </span>
        </span>
      ) : (
        <span className="hidden h-[2.25rem] items-center gap-1.5 text-xs text-ink-faint sm:inline-flex">
          {STEP_KEYS.includes(kind) && t(`agent.${kind}`)}
          {step.model && step.model !== 'Practice mode' && (
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${
                step.model.includes('Open') ? 'bg-kannada-soft text-kannada' : 'bg-telugu-soft text-telugu'
              }`}
            >
              {step.model}
            </span>
          )}
        </span>
      )}
    </li>
  )
}
