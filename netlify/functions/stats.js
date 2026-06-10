/**
 * Netlify Function: stats
 * Route:  GET /api/stats  → weekly consumed / wasted / active counts
 */
import { getSupabaseClient } from './_lib/supabase.js'
import { json, cors, requireAuth } from './_lib/utils.js'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'GET')     return json(405, { error: 'Method not allowed' })

  const auth = requireAuth(event)
  if (!auth.ok) return auth.response

  const supabase = getSupabaseClient(event)

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoISO = weekAgo.toISOString()

  const [consumedRes, expiredRes, activeRes, soonRes] = await Promise.all([
    supabase.from('items').select('avg_cost').eq('status', 'used').gte('created_at', weekAgoISO),
    supabase.from('items').select('avg_cost').eq('status', 'expired').gte('created_at', weekAgoISO),
    supabase.from('items').select('id', { count: 'exact', head: true }).not('status', 'in', '("used","expired")'),
    supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'soon'),
  ])

  const consumed = consumedRes.data || []
  const expired  = expiredRes.data  || []

  return json(200, {
    consumed:     { count: consumed.length, value: consumed.reduce((s, i) => s + (i.avg_cost || 0), 0) },
    expired:      { count: expired.length,  value: expired.reduce((s, i)  => s + (i.avg_cost || 0), 0) },
    active:       activeRes.count || 0,
    expiringSoon: soonRes.count   || 0,
  })
}
