import { getSupabaseClient, getUserId } from '../_lib/supabase.js'
import { computeStatus, computeRemindAt, setCors, requireAuth, DEFAULT_SETTINGS } from '../_lib/utils.js'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAuth(req, res)) return

  const supabase = getSupabaseClient(req)
  const userId = getUserId(req)

  // ── GET /api/items ──────────────────────────────────────────────
  if (req.method === 'GET') {
    const { category, status, search } = req.query
    let query = supabase
      .from('items')
      .select('*')
      .neq('status', 'used')
      .order('expiry_date', { ascending: true })

    if (category && category !== 'All') query = query.eq('category', category)
    if (status && status !== 'all') query = query.eq('status', status)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // ── POST /api/items ─────────────────────────────────────────────
  if (req.method === 'POST') {
    const { name, category, quantity, purchase_date, expiry_date, avg_cost, remind_days_before } =
      req.body || {}

    if (!name || !expiry_date) {
      return res.status(400).json({ error: 'name and expiry_date are required' })
    }

    const status = computeStatus(expiry_date)

    const { data: item, error: itemErr } = await supabase
      .from('items')
      .insert({
        user_id: userId,
        name,
        category: category || 'Other',
        quantity: quantity || null,
        purchase_date: purchase_date || null,
        expiry_date,
        status,
        avg_cost: parseFloat(avg_cost) || 0,
      })
      .select()
      .single()

    if (itemErr) return res.status(500).json({ error: itemErr.message })

    // Get default lead time from user settings
    const { data: settingRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'default_lead_time')
      .single()

    const leadDays =
      remind_days_before !== undefined
        ? parseInt(remind_days_before)
        : parseInt(settingRow?.value || DEFAULT_SETTINGS.default_lead_time)

    const remindAt = computeRemindAt(expiry_date, leadDays)

    await supabase.from('reminders').insert({
      user_id: userId,
      item_id: item.id,
      remind_days_before: leadDays,
      remind_at: remindAt,
      notified: false,
    })

    return res.status(201).json(item)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
