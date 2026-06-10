/**
 * Netlify Function: items-id
 * Routes:  GET    /api/items/:id  → single item
 *          PUT    /api/items/:id  → update
 *          DELETE /api/items/:id  → remove
 *
 * The Netlify redirect passes the original URL in event.rawUrl so we
 * extract the UUID via getIdFromPath().
 */
import { getSupabaseClient } from './_lib/supabase.js'
import {
  json, cors, getBody, getIdFromPath,
  requireAuth, computeStatus, computeRemindAt,
} from './_lib/utils.js'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  const auth = requireAuth(event)
  if (!auth.ok) return auth.response

  const supabase = getSupabaseClient(event)
  const id       = getIdFromPath(event)

  if (!id) return json(400, { error: 'Missing item id in path' })

  // ── GET /api/items/:id ─────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from('items')
      .select('*, reminders(*)')
      .eq('id', id)
      .single()
    if (error) return json(404, { error: 'Item not found' })
    return json(200, data)
  }

  // ── PUT /api/items/:id ─────────────────────────────────────────
  if (event.httpMethod === 'PUT') {
    const body = getBody(event)
    const { name, category, quantity, purchase_date, expiry_date, avg_cost } = body

    const { data: existing, error: fetchErr } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchErr) return json(404, { error: 'Item not found' })

    const newExpiry = expiry_date || existing.expiry_date

    const { data, error } = await supabase
      .from('items')
      .update({
        name:          name          || existing.name,
        category:      category      || existing.category,
        quantity:      quantity      !== undefined ? quantity      : existing.quantity,
        purchase_date: purchase_date !== undefined ? purchase_date : existing.purchase_date,
        expiry_date:   newExpiry,
        status:        computeStatus(newExpiry),
        avg_cost:      avg_cost      !== undefined ? parseFloat(avg_cost) : existing.avg_cost,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return json(500, { error: error.message })

    // Reset reminder if expiry changed
    if (expiry_date && expiry_date !== existing.expiry_date) {
      const { data: reminder } = await supabase
        .from('reminders')
        .select('remind_days_before')
        .eq('item_id', id)
        .single()

      if (reminder) {
        await supabase
          .from('reminders')
          .update({ remind_at: computeRemindAt(expiry_date, reminder.remind_days_before), notified: false })
          .eq('item_id', id)
      }
    }

    return json(200, data)
  }

  // ── DELETE /api/items/:id ──────────────────────────────────────
  if (event.httpMethod === 'DELETE') {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) return json(500, { error: error.message })
    return json(200, { success: true })
  }

  return json(405, { error: 'Method not allowed' })
}
