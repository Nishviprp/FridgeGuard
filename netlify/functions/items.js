/**
 * Netlify Function: items
 * Routes:  GET  /api/items   → list (with optional ?category, ?status, ?search)
 *          POST /api/items   → create item + reminder
 */
import { getSupabaseClient, getUserId } from './_lib/supabase.js'
import {
  json, cors, getBody, getQuery,
  requireAuth, computeStatus, computeRemindAt, DEFAULT_SETTINGS,
} from './_lib/utils.js'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  const auth = requireAuth(event)
  if (!auth.ok) return auth.response

  const supabase = getSupabaseClient(event)
  const userId   = getUserId(event)

  // ── GET /api/items ─────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const { category, status, search } = getQuery(event)

    let query = supabase
      .from('items')
      .select('*')
      .neq('status', 'used')
      .order('expiry_date', { ascending: true })

    if (category && category !== 'All') query = query.eq('category', category)
    if (status   && status   !== 'all') query = query.eq('status',   status)
    if (search)                         query = query.ilike('name',  `%${search}%`)

    const { data, error } = await query
    if (error) return json(500, { error: error.message })
    return json(200, data)
  }

  // ── POST /api/items ────────────────────────────────────────────
  if (event.httpMethod === 'POST') {
    const { name, category, quantity, purchase_date, expiry_date, avg_cost, remind_days_before } =
      getBody(event)

    if (!name || !expiry_date)
      return json(400, { error: 'name and expiry_date are required' })

    const status = computeStatus(expiry_date)

    const { data: item, error: itemErr } = await supabase
      .from('items')
      .insert({
        user_id: userId,
        name,
        category:      category     || 'Other',
        quantity:      quantity      || null,
        purchase_date: purchase_date || null,
        expiry_date,
        status,
        avg_cost: parseFloat(avg_cost) || 0,
      })
      .select()
      .single()

    if (itemErr) return json(500, { error: itemErr.message })

    // Determine reminder lead time
    const { data: settingRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'default_lead_time')
      .single()

    const leadDays =
      remind_days_before !== undefined
        ? parseInt(remind_days_before)
        : parseInt(settingRow?.value || DEFAULT_SETTINGS.default_lead_time)

    await supabase.from('reminders').insert({
      user_id:            userId,
      item_id:            item.id,
      remind_days_before: leadDays,
      remind_at:          computeRemindAt(expiry_date, leadDays),
      notified:           false,
    })

    return json(201, item)
  }

  return json(405, { error: 'Method not allowed' })
}
