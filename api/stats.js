import { getSupabaseClient } from './_lib/supabase.js'
import { setCors, requireAuth } from './_lib/utils.js'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAuth(req, res)) return

  const supabase = getSupabaseClient(req)

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoISO = weekAgo.toISOString()

  const [consumedRes, expiredRes, activeRes, soonRes] = await Promise.all([
    supabase
      .from('items')
      .select('avg_cost')
      .eq('status', 'used')
      .gte('created_at', weekAgoISO),
    supabase
      .from('items')
      .select('avg_cost')
      .eq('status', 'expired')
      .gte('created_at', weekAgoISO),
    supabase
      .from('items')
      .select('id', { count: 'exact', head: true })
      .not('status', 'in', '("used","expired")'),
    supabase
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'soon'),
  ])

  const consumed = consumedRes.data || []
  const expired = expiredRes.data || []

  return res.status(200).json({
    consumed: {
      count: consumed.length,
      value: consumed.reduce((s, i) => s + (i.avg_cost || 0), 0),
    },
    expired: {
      count: expired.length,
      value: expired.reduce((s, i) => s + (i.avg_cost || 0), 0),
    },
    active: activeRes.count || 0,
    expiringSoon: soonRes.count || 0,
  })
}
