import { createClient } from '@supabase/supabase-js'

// Publishable keys are designed to be public: they only allow what row-level security permits.
const SUPABASE_URL = 'https://pvyraebnujmjpyqrfhbp.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_xpi2tGOTJZUeiMYqsO1HLg_sfX4PdVP'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
