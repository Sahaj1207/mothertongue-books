import { Link } from 'react-router-dom'

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-rule/70 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2 rounded-md sm:gap-2.5">
          <img src="/favicon.svg" alt="" className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
          <span className="font-[family-name:var(--font-display)] text-[1.05rem] font-semibold tracking-tight whitespace-nowrap text-ink sm:text-xl">
            MotherTongue Books
          </span>
        </Link>
        <Link
          to="/create"
          className="inline-flex h-11 shrink-0 items-center rounded-full bg-ink px-4 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-ink-soft sm:px-5"
        >
          Create a book
        </Link>
      </div>
    </header>
  )
}
