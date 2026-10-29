import { Link } from 'react-router-dom'
import { useT } from '../lib/i18n'

export function SiteFooter() {
  const t = useT()
  return (
    <footer className="site-footer mt-16 border-t border-rule/70 bg-paper">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-[1.4fr_1fr] sm:px-6">
        <div>
          <p className="flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-semibold">
            <img src="/favicon.svg" alt="" className="h-6 w-6" />
            MotherTongue Books
          </p>
          <p className="mt-2 max-w-sm text-sm text-ink-soft">{t('footer.tagline')}</p>
          <p className="mt-3 max-w-sm text-xs text-ink-faint">{t('footer.ai')}</p>
        </div>
        <nav aria-label={t('footer.label')} className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:justify-self-end">
          <Link to="/" className="text-ink-soft hover:text-ink">
            {t('reader.library')}
          </Link>
          <Link to="/create" className="text-ink-soft hover:text-ink">
            {t('nav.create')}
          </Link>
          <Link to="/privacy" className="text-ink-soft hover:text-ink">
            {t('privacy.title')}
          </Link>
          <a
            href="https://github.com/Sahaj1207/mothertongue-books"
            className="text-ink-soft hover:text-ink"
            target="_blank"
            rel="noreferrer"
          >
            {t('footer.source')}
          </a>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-ink-faint sm:px-6">© 2026 MotherTongue Books</p>
    </footer>
  )
}
