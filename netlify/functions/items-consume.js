/**
 * Netlify Function: items-consume
 * Route:  POST /api/items/:id/consume  → mark item status = 'used'
 */
import { getSupabaseClient } from './_lib/supabase.js'
import { json, cors, getIdFromPath, requireAuth } from './_lib/utils.js'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()
  if (event.httpMethod !== 'POST')    return json(405, { error: 'Method not allowed' })

  const auth = requireAuth(event)
  if (!auth.ok) return auth.response

  const supabase = getSupabaseClient(event)
  const id       = getIdFromPath(event) // /api/items/<uuid>/consume → segments[2]

  if (!id) return json(400, { error: 'Missing item id in path' })

  const { data, error } = await supabase
    .from('items')
    .update({ status: 'used' })
    .eq('id', id)
    .select()
    .single()

  if (error) return json(500, { error: error.message })
  return json(200, data)
}
