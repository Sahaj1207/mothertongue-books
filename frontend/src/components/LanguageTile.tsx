import { LANGUAGES, type LanguageCode } from '../lib/languages'

interface Props {
  code: LanguageCode
  selected: boolean
  onSelect: () => void
  sublabel: React.ReactNode
  /** Radio tiles pick one value; toggle tiles can be switched off again. */
  role?: 'radio' | 'toggle'
}

export function LanguageTile({ code, selected, onSelect, sublabel, role = 'toggle' }: Props) {
  const lang = LANGUAGES[code]
  const a11y = role === 'radio' ? { role: 'radio', 'aria-checked': selected } : { 'aria-pressed': selected }
  return (
    <button
      type="button"
      {...a11y}
      onClick={onSelect}
      className="flex min-h-28 flex-col items-start justify-between rounded-2xl border-2 p-3 text-left transition-colors sm:min-h-32 sm:p-4"
      style={{
        borderColor: lang.color,
        background: selected ? lang.color : 'var(--color-sheet)',
        color: selected ? 'var(--color-on-lang)' : lang.color,
      }}
    >
      <span lang={code} className="pt-1 text-[1.6rem] leading-[1.3] font-semibold sm:text-4xl" style={{ fontFamily: lang.storyFont }}>
        {lang.nativeName}
      </span>
      <span className={`text-xs leading-snug sm:text-sm ${selected ? 'text-on-lang/85' : 'text-ink-soft'}`}>{sublabel}</span>
    </button>
  )
}
