import { getSupabaseClient, getUserId } from './_lib/supabase.js'
import { setCors, requireAuth } from './_lib/utils.js'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAuth(req, res)) return

  const supabase = getSupabaseClient(req)
  const userId = getUserId(req)

  // ── GET /api/notifications ──────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('notification_log')
      .select('*, items(name)')
      .order('sent_at', { ascending: false })
      .limit(100)

    if (error) return res.status(500).json({ error: error.message })

    const unreadCount = (data || []).filter((n) => !n.read).length

    return res.status(200).json({ notifications: data || [], unreadCount })
  }

  // ── PATCH /api/notifications — mark all as read ─────────────────
  if (req.method === 'PATCH') {
    const { ids } = req.body || {}

    let query = supabase.from('notification_log').update({ read: true })
    if (ids?.length) {
      query = query.in('id', ids)
    }
    // (RLS ensures only own notifications are updated)

    const { error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  // ── DELETE /api/notifications — clear all ──────────────────────
  if (req.method === 'DELETE') {
    const { error } = await supabase.from('notification_log').delete().neq('id', '')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
