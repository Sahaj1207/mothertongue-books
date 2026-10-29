import type { StepStatus } from '../lib/api'

/** "notes": the step finished with notes for the adult (the reading-level check is advisory, not a failure). */
export function StepIcon({ status }: { status: StepStatus | 'notes' }) {
  if (status === 'notes') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="var(--color-turmeric)" />
        <path d="M12 6.5v7" stroke="#1f2a44" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="12" cy="17.3" r="1.4" fill="#1f2a44" />
      </svg>
    )
  }
  if (status === 'running') {
    return (
      <span className="relative flex h-6 w-6 items-center justify-center" aria-hidden="true">
        <span className="absolute h-6 w-6 rounded-full bg-turmeric/40 motion-safe:animate-ping" />
        <span className="h-3.5 w-3.5 rounded-full bg-turmeric" />
      </span>
    )
  }
  if (status === 'done') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="var(--color-ink)" />
        <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (status === 'failed') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="var(--color-margin)" />
        <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="var(--color-rule)" strokeWidth="2" />
    </svg>
  )
}
