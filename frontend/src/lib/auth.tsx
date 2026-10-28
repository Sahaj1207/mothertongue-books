import type { User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from './supabase'

interface AuthState {
  user: User | null
  /** False until the saved session has been read, so pages don't flash the sign-in screen. */
  ready: boolean
}

const AuthContext = createContext<AuthState>({ user: null, ready: false })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, ready: false })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ user: data.session?.user ?? null, ready: true }))
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setState({ user: session?.user ?? null, ready: true }),
    )
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}

/** Sends signed-out visitors to the sign-in page, then back here afterwards. */
export function RequireSignIn({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  if (!ready) return null
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/sign-in?next=${next}`} replace />
  }
  return children
}
