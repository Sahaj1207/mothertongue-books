import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

type Mode = 'sign-in' | 'create'

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Try again."
  if (/already registered|already exists/i.test(message)) return 'An account with this email already exists. Sign in instead.'
  if (/email not confirmed/i.test(message)) return 'This account is waiting for email confirmation.'
  if (/password should be/i.test(message)) return 'Use a password with at least 8 characters.'
  if (/rate limit/i.test(message)) return 'Too many attempts. Wait a minute and try again.'
  return message
}

export function SignInPage() {
  const { user, ready } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/my-books'

  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (ready && user) return <Navigate to={next} replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter your email address.')
    if (password.length < 8) return setError('Use a password with at least 8 characters.')
    setBusy(true)
    setError(null)
    const { data, error } =
      mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            // Confirmation links must open the live site, even for accounts made on a local copy.
            options: { emailRedirectTo: 'https://mothertongue-books.vercel.app/sign-in' },
          })
    setBusy(false)
    if (error) return setError(friendly(error.message))
    if (mode === 'create' && !data.session) {
      return setError('Account created, but it needs email confirmation before you can sign in.')
    }
    navigate(next, { replace: true })
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-10 pb-24 sm:pt-16">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
        {mode === 'sign-in' ? 'Sign in' : 'Create an account'}
      </h1>
      <p className="mt-2 text-ink-soft">For parents and teachers who make, check and publish books.</p>

      <div className="mt-6 grid grid-cols-2 rounded-full border border-rule bg-sheet p-1" role="tablist">
        {(['sign-in', 'create'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m)
              setError(null)
            }}
            className={`h-10 rounded-full text-sm font-medium transition-colors ${
              mode === m ? 'bg-ink text-on-ink' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {m === 'sign-in' ? 'Sign in' : 'New account'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="notebook mt-6 space-y-5 rounded-3xl border border-rule py-6 pr-5 pl-16">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 h-12 w-full rounded-xl border-2 border-rule bg-sheet px-3 text-base focus:border-ink focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <div className="relative mt-1.5">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="password-hint"
              className="h-12 w-full rounded-xl border-2 border-rule bg-sheet px-3 pr-20 text-base focus:border-ink focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute top-1/2 right-2 h-9 -translate-y-1/2 rounded-lg px-2.5 text-sm text-ink-soft hover:text-ink"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <p id="password-hint" className="mt-1.5 text-xs text-ink-faint">
            At least 8 characters.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-margin">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="h-12 w-full rounded-full bg-ink font-semibold text-on-ink hover:bg-ink-soft disabled:opacity-60"
        >
          {busy ? 'One moment…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </main>
  )
}
