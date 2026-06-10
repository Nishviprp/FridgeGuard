/**
 * Netlify Function: settings
 * Routes:  GET /api/settings  → all user settings (merged with defaults)
 *          PUT /api/settings  → upsert one or many key-value pairs
 */
import { getSupabaseClient, getUserId } from './_lib/supabase.js'
import { json, cors, getBody, requireAuth, DEFAULT_SETTINGS } from './_lib/utils.js'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  const auth = requireAuth(event)
  if (!auth.ok) return auth.response

  const supabase = getSupabaseClient(event)
  const userId   = getUserId(event)

  // ── GET /api/settings ──────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')

    if (error) return json(500, { error: error.message })

    // Merge DB rows onto defaults so every key is always present
    const result = { ...DEFAULT_SETTINGS }
    for (const row of data || []) result[row.key] = row.value
    return json(200, result)
  }

  // ── PUT /api/settings ──────────────────────────────────────────
  if (event.httpMethod === 'PUT') {
    const updates = getBody(event)
    const rows = Object.entries(updates).map(([key, value]) => ({
      user_id: userId,
      key,
      value: String(value),
    }))

    if (!rows.length) return json(400, { error: 'No settings provided' })

    const { error } = await supabase
      .from('settings')
      .upsert(rows, { onConflict: 'user_id,key' })

    if (error) return json(500, { error: error.message })
    return json(200, { success: true })
  }

  return json(405, { error: 'Method not allowed' })
}
