import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { ThemeSwitcher } from './ThemeSwitcher'

export function AppHeader() {
  const { user } = useAuth()
  const navigate = useNavigate()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-20 border-b border-rule/70 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2 rounded-md sm:gap-2.5">
          <img src="/favicon.svg" alt="" className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
          <span className="hidden font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight whitespace-nowrap text-ink min-[400px]:inline">
            MotherTongue Books
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <ThemeSwitcher />
          {user ? (
            <>
              <NavLink
                to="/my-books"
                className={({ isActive }) =>
                  `inline-flex h-11 items-center rounded-full px-3 text-sm whitespace-nowrap ${
                    isActive ? 'font-semibold text-ink' : 'text-ink-soft hover:text-ink'
                  }`
                }
              >
                My books
              </NavLink>
              <button
                type="button"
                onClick={signOut}
                className="hidden h-11 rounded-full px-3 text-sm text-ink-soft hover:text-ink sm:inline-flex sm:items-center"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link to="/sign-in" className="inline-flex h-11 items-center rounded-full px-3 text-sm text-ink-soft hover:text-ink">
              Sign in
            </Link>
          )}
          <Link
            to="/create"
            className="inline-flex h-11 shrink-0 items-center rounded-full bg-ink px-4 text-sm font-medium whitespace-nowrap text-on-ink transition-colors hover:bg-ink-soft sm:px-5"
          >
            Create a book
          </Link>
        </nav>
      </div>
    </header>
  )
}
