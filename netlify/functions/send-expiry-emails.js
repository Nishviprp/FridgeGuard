/**
 * FridgeGuard — Scheduled Netlify Function: send-expiry-emails
 *
 * Schedule: daily at 8:00 AM UTC  (configured in netlify.toml)
 * Requires:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  — bypasses RLS to read all users' data
 *   RESEND_API_KEY             — get a free key at resend.com
 *   RESEND_FROM_EMAIL          — verified sender address, e.g. noreply@yourdomain.com
 *   APP_URL                    — public URL, e.g. https://fridgeguard.netlify.app
 */

import { Resend }        from 'resend'
import { getAdminClient } from './_lib/supabase.js'

const resend   = new Resend(process.env.RESEND_API_KEY)
const APP_URL  = process.env.APP_URL || 'https://fridgeguard.netlify.app'
const FROM     = process.env.RESEND_FROM_EMAIL || 'FridgeGuard <noreply@fridgeguard.app>'

// ─── Handler ─────────────────────────────────────────────────────────────────
export const handler = async () => {
  try {
    const supabase = getAdminClient()
    const today    = new Date().toISOString().split('T')[0]
    const in5Days  = new Date(Date.now() + 5 * 86_400_000).toISOString().split('T')[0]

    // 1. Fetch all items expiring in the next 5 days (excluding used/expired)
    const { data: allItems, error: itemsErr } = await supabase
      .from('items')
      .select('id, user_id, name, category, expiry_date, status')
      .lte('expiry_date', in5Days)
      .not('status', 'in', '("used","expired")')
      .order('expiry_date', { ascending: true })

    if (itemsErr) throw itemsErr
    if (!allItems?.length) {
      return { statusCode: 200, body: JSON.stringify({ emailsSent: 0, reason: 'no expiring items' }) }
    }

    // 2. Group items by user
    const byUser = {}
    for (const item of allItems) {
      if (!byUser[item.user_id]) byUser[item.user_id] = []
      byUser[item.user_id].push(item)
    }

    let emailsSent = 0
    let skipped    = 0

    // 3. Process each user
    for (const [userId, items] of Object.entries(byUser)) {
      // 3a. Load user settings
      const { data: settingsRows } = await supabase
        .from('settings')
        .select('key, value')
        .eq('user_id', userId)

      const settings = Object.fromEntries((settingsRows || []).map(r => [r.key, r.value]))

      // 3b. Skip if user opted out
      if (settings.email_notifications === 'false') { skipped++; continue }

      // 3c. Get user email via admin API
      const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(userId)
      if (userErr || !user?.email) { skipped++; continue }

      // 3d. Build and send email
      const subject = `🧊 ${items.length} item${items.length !== 1 ? 's' : ''} expiring soon in your fridge!`
      const html    = buildEmailHtml(user.email, items, userId)

      const { error: sendErr } = await resend.emails.send({
        from:    FROM,
        to:      user.email,
        subject,
        html,
      })

      if (sendErr) {
        console.error(`Failed to email ${user.email}:`, sendErr)
      } else {
        emailsSent++
      }
    }

    console.log(`[send-expiry-emails] sent=${emailsSent} skipped=${skipped}`)
    return {
      statusCode: 200,
      body: JSON.stringify({ emailsSent, skipped }),
    }
  } catch (err) {
    console.error('[send-expiry-emails] fatal:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

// ─── Email HTML builder ───────────────────────────────────────────────────────

function buildEmailHtml(userEmail, items, userId) {
  const today    = new Date(); today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const todayItems  = items.filter(i => i.expiry_date === todayStr)
  const soonItems   = items.filter(i => {
    const diff = daysDiff(i.expiry_date, todayStr)
    return diff > 0 && diff <= 2
  })
  const laterItems  = items.filter(i => {
    const diff = daysDiff(i.expiry_date, todayStr)
    return diff > 2
  })

  const unsubUrl = `${APP_URL}/api/unsubscribe?user=${encodeURIComponent(userId)}`

  const rows = (label, color, emoji, list) => list.length === 0 ? '' : `
    <tr>
      <td style="padding:12px 0 4px;">
        <span style="background:${color};color:#fff;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">
          ${emoji} ${label}
        </span>
      </td>
    </tr>
    ${list.map(item => `
      <tr>
        <td style="padding:4px 0 4px 16px;font-size:14px;color:#374151;border-bottom:1px solid #f3f4f6;">
          ${categoryEmoji(item.category)} <strong>${escHtml(item.name)}</strong>
          <span style="color:#9CA3AF;font-size:12px;margin-left:6px;">${item.quantity || ''}</span>
        </td>
      </tr>`).join('')}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FridgeGuard Daily Digest</title>
</head>
<body style="margin:0;padding:0;background:#F9FAF7;font-family:'Inter',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAF7;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0">

        <!-- Header -->
        <tr>
          <td align="center" style="padding-bottom:24px;">
            <div style="font-size:48px;line-height:1;">🧊</div>
            <h1 style="margin:8px 0 4px;font-size:22px;font-weight:700;color:#2D3B2C;">FridgeGuard</h1>
            <p style="margin:0;font-size:13px;color:#8A9E89;">Your daily fridge digest</p>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:#fff;border-radius:12px;border:1px solid #E8EDE6;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

            <p style="margin:0 0 20px;font-size:15px;color:#2D3B2C;">
              Here's what needs your attention today:
            </p>

            <table width="100%" cellpadding="0" cellspacing="0">
              ${rows('Expires TODAY', '#E05C5C', '🔴', todayItems)}
              ${rows('Expires in 1–2 days', '#F2A65A', '🟡', soonItems)}
              ${rows('Expires in 3–5 days', '#7CAE7A', '🟢', laterItems)}
            </table>

            <!-- CTA -->
            <div style="text-align:center;margin-top:28px;">
              <a href="${APP_URL}" style="background:#7CAE7A;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;">
                View My Fridge →
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 0 0;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;">
              Sent to ${escHtml(userEmail)} ·
              <a href="${unsubUrl}" style="color:#9CA3AF;">Unsubscribe from emails</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysDiff(expiryDate, todayStr) {
  const exp   = new Date(expiryDate + 'T00:00:00')
  const today = new Date(todayStr  + 'T00:00:00')
  return Math.ceil((exp - today) / 86_400_000)
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const CATEGORY_EMOJI_MAP = {
  Dairy: '🥛', Vegetable: '🥦', Fruit: '🍎', Meat: '🥩',
  Snack: '🍪', Beverage: '🧃', Other: '📦',
}
function categoryEmoji(cat) { return CATEGORY_EMOJI_MAP[cat] || '📦' }
