import { useT } from '../lib/i18n'
import { usePageTitle } from '../lib/title'
import type { MessageKey } from '../locales/en'

const SECTIONS: { title: MessageKey; points: MessageKey[] }[] = [
  { title: 'privacy.keepTitle', points: ['privacy.keep1', 'privacy.keep2', 'privacy.keep3', 'privacy.keep4'] },
  { title: 'privacy.childrenTitle', points: ['privacy.children1', 'privacy.children2'] },
  { title: 'privacy.aiTitle', points: ['privacy.ai1', 'privacy.ai2'] },
  { title: 'privacy.choicesTitle', points: ['privacy.choices1', 'privacy.choices2', 'privacy.choices3'] },
]

export function PrivacyPage() {
  const t = useT()
  usePageTitle(t('privacy.title'))
  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold sm:text-4xl">{t('privacy.title')}</h1>
      <p className="mt-3 text-lg text-ink-soft">{t('privacy.intro')}</p>
      {SECTIONS.map((section) => (
        <section key={section.title} className="mt-8">
          <h2 className="text-lg font-semibold">{t(section.title)}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-soft">
            {section.points.map((point) => (
              <li key={point}>{t(point)}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="mt-10 text-sm text-ink-faint">{t('privacy.updated')}</p>
    </main>
  )
}
