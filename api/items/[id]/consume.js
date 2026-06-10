import { getSupabaseClient } from '../../_lib/supabase.js'
import { setCors, requireAuth } from '../../_lib/utils.js'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireAuth(req, res)) return

  const supabase = getSupabaseClient(req)
  const { id } = req.query

  const { data, error } = await supabase
    .from('items')
    .update({ status: 'used' })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json(data)
}
