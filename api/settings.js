import { getSupabaseClient, getUserId } from './_lib/supabase.js'
import { setCors, requireAuth, DEFAULT_SETTINGS } from './_lib/utils.js'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAuth(req, res)) return

  const supabase = getSupabaseClient(req)
  const userId = getUserId(req)

  // ── GET /api/settings ───────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')

    if (error) return res.status(500).json({ error: error.message })

    // Merge with defaults so every key is always present
    const result = { ...DEFAULT_SETTINGS }
    for (const row of data || []) result[row.key] = row.value
    return res.status(200).json(result)
  }

  // ── PUT /api/settings ───────────────────────────────────────────
  if (req.method === 'PUT') {
    const updates = req.body || {}
    const rows = Object.entries(updates).map(([key, value]) => ({
      user_id: userId,
      key,
      value: String(value),
    }))

    const { error } = await supabase
      .from('settings')
      .upsert(rows, { onConflict: 'user_id,key' })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  // ── POST /api/settings/push-subscription ───────────────────────
  // (handled via push_subscriptions table directly from frontend)

  return res.status(405).json({ error: 'Method not allowed' })
}
