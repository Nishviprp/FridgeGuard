/**
 * GET /api/test-notifications
 *
 * Sends a test email + push notification to the currently logged-in user.
 * Only works when NODE_ENV !== 'production' OR ALLOW_TEST_NOTIFICATIONS=true.
 * Returns { emailSent, pushSent, itemsFound }
 *
 * NOTE: Netlify always sets NODE_ENV=production in deployed functions.
 * Set ALLOW_TEST_NOTIFICATIONS=true in your Netlify env vars to enable this
 * endpoint on your staging/preview URLs.
 */
import { Resend }             from 'resend'
import webPush                from 'web-push'
import { getSupabaseClient, getUserId } from './_lib/supabase.js'
import { json, cors, requireAuth }      from './_lib/utils.js'

const FROM    = process.env.RESEND_FROM_EMAIL || 'FridgeGuard <noreply@fridgeguard.app>'
const APP_URL = process.env.APP_URL || 'https://fridgeguard.netlify.app'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return cors()

  // Guard: dev/staging only
  const allowed =
    process.env.NODE_ENV !== 'production' ||
    process.env.ALLOW_TEST_NOTIFICATIONS === 'true'

  if (!allowed) {
    return json(403, { error: 'Test notifications are disabled in production. Set ALLOW_TEST_NOTIFICATIONS=true to enable.' })
  }

  if (!requireAuth(event).ok) return json(401, { error: 'Unauthorized' })

  const supabase = getSupabaseClient(event)
  const userId   = getUserId(event)

  // Get user details + items
  const [{ data: { user } }, { data: items }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('items')
      .select('name, category, expiry_date, status')
      .not('status', 'in', '("used","expired")')
      .limit(5),
  ])

  const result = { emailSent: false, pushSent: false, itemsFound: items?.length ?? 0 }

  // ── Test email ──────────────────────────────────────────────
  if (process.env.RESEND_API_KEY && user?.email) {
    const resend  = new Resend(process.env.RESEND_API_KEY)
    const testItems = (items ?? []).length > 0
      ? items
      : [{ name: 'Test Item', category: 'Dairy', expiry_date: new Date().toISOString().split('T')[0], status: 'today' }]

    const { error } = await resend.emails.send({
      from:    FROM,
      to:      user.email,
      subject: '🧊 FridgeGuard — Test notification',
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:2rem;text-align:center;">
        <div style="font-size:3rem">🧊</div>
        <h2>Test Email Working!</h2>
        <p>This is a test notification from FridgeGuard.</p>
        <p>Found <strong>${testItems.length}</strong> active item(s) in your fridge.</p>
        <a href="${APP_URL}" style="background:#7CAE7A;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:1rem;">Open FridgeGuard →</a>
      </div>`,
    })
    result.emailSent = !error
    if (error) result.emailError = error.message
  }

  // ── Test push ───────────────────────────────────────────────
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webPush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || 'admin@fridgeguard.app'}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)

    for (const sub of subs ?? []) {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: '🧊 FridgeGuard Test',
            body:  'Push notifications are working!',
            icon:  '/icon-192.png',
            badge: '/badge-72.png',
            url:   APP_URL,
          })
        )
        result.pushSent = true
      } catch (err) {
        result.pushError = err.message
      }
    }
  }

  return json(200, result)
}
