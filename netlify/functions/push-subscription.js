/**
 * Netlify Function: push-subscription
 * Routes:  GET    /api/push-subscription  → return VAPID public key
 *          POST   /api/push-subscription  → save Web Push subscription
 *          DELETE /api/push-subscription  → remove subscription
 */
import { getSupabaseClient, getUserId } from './_lib/supabase.js'
import { json, cors, getBody, requireAuth } from './_lib/utils.js'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  const auth = requireAuth(event)
  if (!auth.ok) return auth.response

  const supabase = getSupabaseClient(event)
  const userId   = getUserId(event)

  // ── GET — VAPID public key ─────────────────────────────────────
  if (event.httpMethod === 'GET') {
    return json(200, { vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '' })
  }

  // ── POST — save subscription ───────────────────────────────────
  if (event.httpMethod === 'POST') {
    const { endpoint, keys } = getBody(event)
    if (!endpoint || !keys?.p256dh || !keys?.auth)
      return json(400, { error: 'Invalid subscription object' })

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
        { onConflict: 'user_id,endpoint' }
      )
    if (error) return json(500, { error: error.message })

    await supabase
      .from('settings')
      .upsert({ user_id: userId, key: 'push_enabled', value: 'true' }, { onConflict: 'user_id,key' })

    return json(200, { success: true })
  }

  // ── DELETE — remove subscription ──────────────────────────────
  if (event.httpMethod === 'DELETE') {
    await supabase.from('push_subscriptions').delete().eq('user_id', userId)
    await supabase
      .from('settings')
      .upsert({ user_id: userId, key: 'push_enabled', value: 'false' }, { onConflict: 'user_id,key' })
    return json(200, { success: true })
  }

  return json(405, { error: 'Method not allowed' })
}
