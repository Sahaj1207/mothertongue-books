import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StepIcon } from '../components/StepIcon'
import { api, type Job, type Step } from '../lib/api'
import { languageDisplay, LANGUAGES } from '../lib/languages'
import type { AnyLanguage } from '../lib/api'

const AGENT_NAME: Record<string, string> = {
  topic_check: 'Topic check',
  planner: 'Planner agent',
  writer: 'Writer agent',
  reading_level: 'Reading-level checker',
  safety: 'Safety reviewer',
  illustrator: 'Illustrator and picture checker',
  tap_words: 'Word finder',
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
        <p className="text-ink-soft">{error ?? 'Starting…'}</p>
      </Shell>
    )
  }

  const [setup, ...rest] = groupSteps(job.steps)
  const lang = LANGUAGES[job.request.language]

  return (
    <Shell>
      <p className="text-sm text-ink-faint">
        {lang.name}
        {job.request.pair_language && ` and ${languageDisplay(job.request.pair_language).name}`}
        , ages {['3–5', '5–7', '7–9'][job.request.level - 1]}
      </p>
      <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl leading-tight font-semibold sm:text-4xl">
        {job.status === 'done' ? 'Your book is ready' : job.status === 'running' ? 'Making your book' : "This book wasn't made"}
      </h1>
      <p className="mt-2 text-lg text-ink-soft">“{job.request.topic}”</p>

      {mock && (
        <p className="mt-4 rounded-xl bg-turmeric-soft px-4 py-3 text-sm">
          Practice mode: agents return sample text while the AI models are being connected.
        </p>
      )}

      <div className="notebook mt-8 rounded-3xl border border-rule py-[2.25rem] pr-4 pl-16 sm:pr-6" aria-live="polite">
        <StepGroup title="Getting ready" steps={setup.steps} />
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
          className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-full bg-ink px-10 text-lg font-semibold text-white hover:bg-ink-soft sm:w-auto"
        >
          Review the book
        </Link>
      )}

      {(job.status === 'blocked' || job.status === 'failed') && (
        <div role="alert" className="mt-8 rounded-2xl border-2 border-margin/40 bg-sheet p-5">
          <p className="font-medium">{job.message}</p>
          <Link
            to="/create"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-ink-soft"
          >
            {job.status === 'blocked' ? 'Change the topic' : 'Try again'}
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

function groupSteps(steps: Step[]): Group[] {
  const groups: Group[] = [{ lang: 'setup', title: 'Getting ready', steps: [] }]
  for (const step of steps) {
    if (PICTURE_STEPS.has(step.key)) {
      let pictures = groups.find((g) => g.lang === 'pictures')
      if (!pictures) groups.push((pictures = { lang: 'pictures', title: 'Pictures', steps: [] }))
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
      group = { lang, title: languageDisplay(lang as AnyLanguage).name, steps: [] }
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
          <li key={step.key} className="flex h-[2.25rem] items-center gap-3">
            <StepIcon status={step.status} />
            <span className={`min-w-0 flex-1 truncate ${step.status === 'waiting' ? 'text-ink-faint' : ''}`}>
              {step.label}
              <span className="sr-only">: {step.status}</span>
            </span>
            {step.detail ? (
              <span className="rounded-full bg-turmeric-soft px-2.5 py-0.5 text-xs whitespace-nowrap">{step.detail}</span>
            ) : (
              <span className="hidden items-center gap-1.5 text-xs text-ink-faint sm:inline-flex">
                {AGENT_NAME[step.key.split(':')[0]]}
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
        ))}
      </ol>
    </section>
  )
}
