import { useState } from 'react'
import { useT } from '../lib/i18n'
import { recalled, remember } from '../lib/theme'
import type { MessageKey } from '../locales/en'

export interface Tip {
  text: MessageKey
  /** A tip can wait for its moment, like the end-of-book tip until the last page. */
  ready?: boolean
}

/**
 * First-time tips, one at a time, where they're needed. "Got it" moves on, "Skip tips" ends them;
 * either way they never come back for this set.
 */
export function Tips({ id, tips, inline = false }: { id: string; tips: Tip[]; inline?: boolean }) {
  const t = useT()
  const key = `tips-${id}`
  const [step, setStep] = useState(() => (recalled(key) === 'done' ? tips.length : 0))
  const tip = tips[step]
  if (!tip || tip.ready === false) return null

  function finish() {
    remember(key, 'done')
    setStep(tips.length)
  }

  function next() {
    if (step + 1 >= tips.length) finish()
    else setStep(step + 1)
  }

  return (
    <div
      role="status"
      className={inline ? 'mb-6' : 'fixed inset-x-4 top-[4.75rem] z-30 sm:inset-x-auto sm:top-auto sm:right-8 sm:bottom-8 sm:w-96'}
    >
      <div className="tip-card rounded-2xl bg-sheet p-4 shadow-lg ring-2 ring-turmeric">
        <p className="flex gap-2.5 text-sm leading-relaxed">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-turmeric text-xs font-bold text-[#1f2a44]"
          >
            !
          </span>
          <span>
            <span className="sr-only">{t('tip.label')}: </span>
            {t(tip.text)}
          </span>
        </p>
        <div className="mt-3 flex items-center gap-2 pl-8">
          {tips.length > 1 && (
            <span className="mr-auto text-xs text-ink-faint">
              {step + 1} / {tips.length}
            </span>
          )}
          {tips.length > 1 && step + 1 < tips.length && (
            <button type="button" onClick={finish} className="h-9 px-2 text-sm text-ink-soft hover:text-ink">
              {t('tip.skip')}
            </button>
          )}
          <button
            type="button"
            onClick={next}
            className={`h-9 rounded-full border-2 border-ink px-4 text-sm font-semibold ${tips.length > 1 ? '' : 'ml-auto'}`}
          >
            {t('tip.gotIt')}
          </button>
        </div>
      </div>
    </div>
  )
}
