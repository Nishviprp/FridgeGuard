/**
 * GET /api/unsubscribe?user=<userId>
 *
 * One-click email unsubscribe link embedded in every digest email.
 * Sets email_notifications = 'false' for the user and returns a
 * simple HTML confirmation page (no login required).
 */
import { getAdminClient } from './_lib/supabase.js'

export const handler = async (event) => {
  const userId = event.queryStringParameters?.user
  if (!userId) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/html' }, body: html('Error', 'Missing user parameter.') }
  }

  try {
    const supabase = getAdminClient()

    await supabase.from('settings').upsert(
      { user_id: userId, key: 'email_notifications', value: 'false' },
      { onConflict: 'user_id,key' }
    )

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: html(
        'Unsubscribed',
        `<p>You've been unsubscribed from FridgeGuard email digests.</p>
         <p>You can re-enable them anytime in <a href="${process.env.APP_URL || '/'}/settings">Settings</a>.</p>`
      ),
    }
  } catch (err) {
    console.error('Unsubscribe error:', err)
    return { statusCode: 500, headers: { 'Content-Type': 'text/html' }, body: html('Error', 'Something went wrong. Please try again.') }
  }
}

function html(title, body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <title>FridgeGuard — ${title}</title>
  <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#F9FAF7;color:#2D3B2C;}
  .card{background:#fff;border:1px solid #E8EDE6;border-radius:12px;padding:2rem;max-width:400px;text-align:center;}
  h1{margin:0 0 1rem;font-size:1.25rem;} a{color:#7CAE7A;}</style>
  </head><body><div class="card"><div style="font-size:3rem">🧊</div><h1>${title}</h1>${body}</div></body></html>`
}
