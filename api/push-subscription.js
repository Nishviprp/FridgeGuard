import { getSupabaseClient, getUserId } from './_lib/supabase.js'
import { setCors, requireAuth } from './_lib/utils.js'

export default async function handler(req, res) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAuth(req, res)) return

  const supabase = getSupabaseClient(req)
  const userId = getUserId(req)

  // ── POST — save subscription ─────────────────────────────────────
  if (req.method === 'POST') {
    const { endpoint, keys } = req.body || {}
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription object' })
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'user_id,endpoint' }
    )
    if (error) return res.status(500).json({ error: error.message })

    // Also toggle push_enabled setting
    await supabase.from('settings').upsert(
      { user_id: userId, key: 'push_enabled', value: 'true' },
      { onConflict: 'user_id,key' }
    )

    return res.status(200).json({ success: true })
  }

  // ── DELETE — remove subscription ─────────────────────────────────
  if (req.method === 'DELETE') {
    await supabase.from('push_subscriptions').delete().eq('user_id', userId)
    await supabase.from('settings').upsert(
      { user_id: userId, key: 'push_enabled', value: 'false' },
      { onConflict: 'user_id,key' }
    )
    return res.status(200).json({ success: true })
  }

  // ── GET — VAPID public key ────────────────────────────────────────
  if (req.method === 'GET') {
    return res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
