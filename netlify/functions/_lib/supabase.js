import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

/**
 * Creates a Supabase client authenticated with the user's JWT.
 * RLS policies enforce row-level access automatically.
 * Netlify passes headers as a plain object; normalise to lower-case.
 */
export function getSupabaseClient(event) {
  const authHeader =
    event.headers['authorization'] ||
    event.headers['Authorization'] ||
    ''
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false },
  })
}

/**
 * Extracts the user ID (sub) from the JWT without re-verifying.
 * Supabase verifies it server-side on every query via RLS.
 */
export function getUserId(event) {
  const authHeader =
    event.headers['authorization'] ||
    event.headers['Authorization'] ||
    ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return null
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString()
    )
    return payload.sub || null
  } catch {
    return null
  }
}
