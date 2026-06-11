/**
 * FridgeGuard — Scheduled Netlify Function: send-push-notifications
 *
 * Schedule: daily at 8:00 AM UTC  (configured in netlify.toml)
 * Requires:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_EMAIL
 */

import webPush        from 'web-push'
import { getAdminClient } from './_lib/supabase.js'

const APP_URL = process.env.APP_URL || 'https://fridgeguard.netlify.app'

// ─── Handler ─────────────────────────────────────────────────────────────────
export const handler = async () => {
  // Validate VAPID keys
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('[send-push] VAPID keys not configured — skipping')
    return { statusCode: 200, body: JSON.stringify({ pushSent: 0, reason: 'vapid keys missing' }) }
  }

  webPush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'admin@fridgeguard.app'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  try {
    const supabase = getAdminClient()
    const in5Days  = new Date(Date.now() + 5 * 86_400_000).toISOString().split('T')[0]

    // 1. Get users who have push subscriptions
    const { data: subscriptions, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')

    if (subErr) throw subErr
    if (!subscriptions?.length) {
      return { statusCode: 200, body: JSON.stringify({ pushSent: 0, reason: 'no subscriptions' }) }
    }

    let pushSent = 0
    let skipped  = 0

    for (const sub of subscriptions) {
      const { user_id, endpoint, p256dh, auth } = sub

      // Check push_enabled setting
      const { data: settingRow } = await supabase
        .from('settings')
        .select('value')
        .eq('user_id', user_id)
        .eq('key', 'push_enabled')
        .single()

      if (settingRow?.value === 'false') { skipped++; continue }

      // Get expiring items for this user
      const { data: items } = await supabase
        .from('items')
        .select('name, expiry_date, status')
        .eq('user_id', user_id)
        .lte('expiry_date', in5Days)
        .not('status', 'in', '("used","expired")')
        .order('expiry_date', { ascending: true })

      if (!items?.length) { skipped++; continue }

      // Build push payload
      const payload = buildPushPayload(items)

      try {
        await webPush.sendNotification(
          { endpoint, keys: { p256dh, auth } },
          JSON.stringify({ ...payload, url: APP_URL }),
        )
        pushSent++
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired — remove it
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user_id)
            .eq('endpoint', endpoint)
          console.log(`[send-push] Removed stale subscription for user ${user_id}`)
        } else {
          console.error(`[send-push] Push failed for user ${user_id}:`, err.message)
        }
      }
    }

    console.log(`[send-push] sent=${pushSent} skipped=${skipped}`)
    return { statusCode: 200, body: JSON.stringify({ pushSent, skipped }) }
  } catch (err) {
    console.error('[send-push] fatal:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

// ─── Build notification payload based on item count ──────────────────────────

function buildPushPayload(items) {
  const todayStr = new Date().toISOString().split('T')[0]
  const todayItems = items.filter(i => i.expiry_date === todayStr)
  const allCount   = items.length

  let title = 'FridgeGuard'
  let body

  if (allCount === 1) {
    body = `${categoryEmoji(items[0])} ${items[0].name} expires ${items[0].expiry_date === todayStr ? 'today' : 'soon'}!`
  } else if (allCount <= 3) {
    const names = items.slice(0, 3).map(i => i.name).join(', ')
    body = todayItems.length
      ? `🔴 ${names} expire${allCount === 1 ? 's' : ''} today!`
      : `🟡 ${names} expire${allCount === 1 ? 's' : ''} soon!`
  } else {
    body = `🧊 ${allCount} items expiring soon — check your fridge`
  }

  if (todayItems.length > 0) title = '⚠️ Items expire today!'

  return { title, body, icon: '/icon-192.png', badge: '/badge-72.png', tag: 'expiry-alert' }
}

const EMOJI_MAP = { Dairy:'🥛', Vegetable:'🥦', Fruit:'🍎', Meat:'🥩', Snack:'🍪', Beverage:'🧃', Other:'📦' }
function categoryEmoji(item) { return EMOJI_MAP[item.category] || '🧊' }
