import { getSupabaseClient, getUserId } from '../_lib/supabase.js'
import { computeStatus, computeRemindAt, setCors, requireAuth } from '../_lib/utils.js'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAuth(req, res)) return

  const supabase = getSupabaseClient(req)
  const userId = getUserId(req)
  const { id } = req.query

  // ── GET /api/items/:id ──────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('items')
      .select('*, reminders(*)')
      .eq('id', id)
      .single()

    if (error) return res.status(404).json({ error: 'Item not found' })
    return res.status(200).json(data)
  }

  // ── PUT /api/items/:id ──────────────────────────────────────────
  if (req.method === 'PUT') {
    const { name, category, quantity, purchase_date, expiry_date, avg_cost } = req.body || {}

    // Fetch existing to merge
    const { data: existing, error: fetchErr } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchErr) return res.status(404).json({ error: 'Item not found' })

    const newExpiry = expiry_date || existing.expiry_date
    const newStatus = computeStatus(newExpiry)

    const updates = {
      name: name || existing.name,
      category: category || existing.category,
      quantity: quantity !== undefined ? quantity : existing.quantity,
      purchase_date: purchase_date !== undefined ? purchase_date : existing.purchase_date,
      expiry_date: newExpiry,
      status: newStatus,
      avg_cost: avg_cost !== undefined ? parseFloat(avg_cost) : existing.avg_cost,
    }

    const { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Update reminder if expiry changed
    if (expiry_date && expiry_date !== existing.expiry_date) {
      const { data: reminder } = await supabase
        .from('reminders')
        .select('remind_days_before')
        .eq('item_id', id)
        .single()

      if (reminder) {
        const remindAt = computeRemindAt(expiry_date, reminder.remind_days_before)
        await supabase
          .from('reminders')
          .update({ remind_at: remindAt, notified: false })
          .eq('item_id', id)
      }
    }

    return res.status(200).json(data)
  }

  // ── DELETE /api/items/:id ───────────────────────────────────────
  if (req.method === 'DELETE') {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
