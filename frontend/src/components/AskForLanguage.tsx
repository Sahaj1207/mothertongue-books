import { useState } from 'react'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'

/** "More languages coming", and a short form to ask for one. No personal details are asked for. */
export function AskForLanguage() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [language, setLanguage] = useState('')
  const [canHelp, setCanHelp] = useState(false)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (language.trim().length < 2) return
    setState('sending')
    try {
      await api.askForLanguage(language.trim(), canHelp)
      setState('sent')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="mt-4 text-sm">
      <p className="text-ink-soft">
        {t('soon.line')}{' '}
        {!open && state !== 'sent' && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="font-medium text-ink underline underline-offset-4"
          >
            {t('ask.open')}
          </button>
        )}
      </p>
      {state === 'sent' ? (
        <p role="status" className="mt-3 rounded-xl bg-turmeric-soft px-3.5 py-2.5">
          {t('ask.thanks')}
        </p>
      ) : (
        open && (
          <form onSubmit={send} className="mt-3 max-w-md space-y-3 rounded-2xl border border-rule bg-sheet p-4">
            <label className="block font-medium">
              {t('ask.label')}
              <input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                maxLength={60}
                placeholder={t('ask.placeholder')}
                className="mt-1.5 h-11 w-full rounded-xl border-2 border-rule bg-sheet px-3 font-normal placeholder:text-ink-faint focus:border-ink focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={canHelp}
                onChange={(e) => setCanHelp(e.target.checked)}
                className="h-5 w-5 accent-[var(--color-ink)]"
              />
              {t('ask.canHelp')}
            </label>
            {state === 'error' && (
              <p role="alert" className="font-medium text-margin">
                {t('ask.error')}
              </p>
            )}
            <button
              type="submit"
              disabled={state === 'sending' || language.trim().length < 2}
              className="h-10 rounded-full bg-ink px-5 font-semibold text-on-ink hover:bg-ink-soft disabled:opacity-60"
            >
              {state === 'sending' ? t('ask.sending') : t('ask.send')}
            </button>
          </form>
        )
      )}
    </div>
  )
}
