/**
 * Netlify Function: notifications
 * Routes:  GET    /api/notifications  → list + unread count
 *          PATCH  /api/notifications  → mark all (or specific ids) as read
 *          DELETE /api/notifications  → clear all
 */
import { getSupabaseClient } from './_lib/supabase.js'
import { json, cors, getBody, requireAuth } from './_lib/utils.js'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  const auth = requireAuth(event)
  if (!auth.ok) return auth.response

  const supabase = getSupabaseClient(event)

  // ── GET /api/notifications ─────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from('notification_log')
      .select('*, items(name)')
      .order('sent_at', { ascending: false })
      .limit(100)

    if (error) return json(500, { error: error.message })

    const notifications = data || []
    const unreadCount   = notifications.filter(n => !n.read).length
    return json(200, { notifications, unreadCount })
  }

  // ── PATCH /api/notifications — mark as read ────────────────────
  if (event.httpMethod === 'PATCH') {
    const { ids } = getBody(event)
    let query = supabase.from('notification_log').update({ read: true })
    if (ids?.length) query = query.in('id', ids)
    // (no extra filter needed — RLS ensures only own rows are updated)

    const { error } = await query
    if (error) return json(500, { error: error.message })
    return json(200, { success: true })
  }

  // ── DELETE /api/notifications — clear all ──────────────────────
  if (event.httpMethod === 'DELETE') {
    // Delete all rows for this user (RLS restricts to own rows)
    const { error } = await supabase
      .from('notification_log')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // match-all trick

    if (error) return json(500, { error: error.message })
    return json(200, { success: true })
  }

  return json(405, { error: 'Method not allowed' })
}
