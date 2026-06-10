/**
 * FridgeGuard — Supabase Edge Function: check-expiry
 *
 * Schedule: Daily at 08:00 UTC
 * Set up in Supabase dashboard → Edge Functions → Schedules
 * Or with CLI: supabase functions deploy check-expiry --schedule "0 8 * * *"
 *
 * What it does:
 *  1. Refreshes all item statuses based on today's date
 *  2. Finds all unnotified reminders that are due
 *  3. Logs notifications to notification_log
 *  4. Sends browser push notifications (if subscription exists)
 *  5. Marks reminders as notified
 */

import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
const vapidEmail = Deno.env.get('VAPID_EMAIL') || 'admin@fridgeguard.app'

const supabase = createClient(supabaseUrl, serviceRoleKey)

Deno.serve(async (_req) => {
  try {
    const today = new Date().toISOString().split('T')[0]

    // 1. Refresh all item statuses
    await supabase.rpc('refresh_item_statuses')

    // 2. Find due reminders (not yet notified, remind_at <= today)
    const { data: dueReminders, error: remErr } = await supabase
      .from('reminders')
      .select(`
        id, user_id, remind_days_before,
        items!inner(id, name, expiry_date, status)
      `)
      .eq('notified', false)
      .lte('remind_at', today)
      .not('items.status', 'in', '("used","expired")')

    if (remErr) throw remErr

    if (!dueReminders || dueReminders.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 3. Build and log notifications
    const notifications = dueReminders.map((r: any) => {
      const item = r.items
      const daysLeft = Math.ceil(
        (new Date(item.expiry_date).getTime() - new Date(today).getTime()) /
          (1000 * 60 * 60 * 24)
      )
      const message =
        daysLeft <= 0
          ? `⚠️ ${item.name} has expired!`
          : daysLeft === 1
          ? `🔴 ${item.name} expires tomorrow!`
          : `🟡 ${item.name} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`

      return { user_id: r.user_id, item_id: item.id, message }
    })

    const { error: logErr } = await supabase
      .from('notification_log')
      .insert(notifications)
    if (logErr) console.error('Log insert error:', logErr)

    // 4. Send push notifications (if VAPID keys configured)
    if (vapidPublicKey && vapidPrivateKey) {
      for (const notif of notifications) {
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('endpoint, p256dh, auth')
          .eq('user_id', notif.user_id)

        for (const sub of subs || []) {
          try {
            // Deno-compatible Web Push via fetch with manual signing is complex —
            // delegate to a separate HTTP call to a push sender or use npm:web-push
            const { webPush } = await import('npm:web-push@3')
            webPush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey)
            await webPush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({ title: 'FridgeGuard', body: notif.message, icon: '/icon-192.png' })
            )
          } catch (pushErr) {
            console.error('Push failed:', pushErr)
            // If subscription expired, remove it
            if ((pushErr as any)?.statusCode === 410) {
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('user_id', notif.user_id)
                .eq('endpoint', sub.endpoint)
            }
          }
        }
      }
    }

    // 5. Mark reminders as notified
    const reminderIds = dueReminders.map((r: any) => r.id)
    await supabase.from('reminders').update({ notified: true }).in('id', reminderIds)

    return new Response(
      JSON.stringify({ processed: dueReminders.length }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
