import { Link } from 'react-router-dom'
import { useT } from '../lib/i18n'

export function ComingSoonPage() {
  const t = useT()
  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">{t('notFound.title')}</h1>
      <p className="mt-2 text-ink-soft">{t('notFound.body')}</p>
      <Link to="/" className="mt-6 inline-block font-medium underline underline-offset-4">
        {t('common.backToLibrary')}
      </Link>
    </main>
  )
}
