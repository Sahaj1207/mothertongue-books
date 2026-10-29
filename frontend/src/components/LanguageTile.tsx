import { useT } from '../lib/i18n'
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
  const t = useT()
  // Kiswahili, Euskara and isiZulu are long in Latin letters; keep them inside a phone-width tile.
  const long = lang.nativeName.length > 6
  const a11y = role === 'radio' ? { role: 'radio', 'aria-checked': selected } : { 'aria-pressed': selected }
  return (
    <button
      type="button"
      {...a11y}
      onClick={onSelect}
      className="relative flex min-h-28 min-w-0 flex-col items-start justify-between rounded-2xl border-2 p-3 text-left transition-colors sm:min-h-32 sm:p-4"
      style={{
        borderColor: lang.color,
        background: selected ? lang.color : 'var(--color-sheet)',
        color: selected ? 'var(--color-on-lang)' : lang.color,
      }}
    >
      {!lang.reviewed && (
        <span className="absolute right-2 bottom-2 rounded-full bg-turmeric px-1.5 py-px text-[0.65rem] font-semibold text-[#1f2a44]">
          {t('lang.new')}
        </span>
      )}
      <span
        lang={code}
        className={`max-w-full pt-1 leading-[1.3] font-semibold break-words ${long ? 'text-[1.2rem] sm:text-3xl' : 'text-[1.6rem] sm:text-4xl'}`}
        style={{ fontFamily: lang.storyFont }}
      >
        {lang.nativeName}
      </span>
      <span className={`text-xs leading-snug sm:text-sm ${selected ? 'text-on-lang/85' : 'text-ink-soft'}`}>
        {sublabel}
      </span>
    </button>
  )
}
