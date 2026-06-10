// ─── Response helpers ────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/** Return a JSON Netlify response object */
export function json(statusCode, data) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...CORS },
    body: JSON.stringify(data),
  }
}

/** Preflight CORS response */
export function cors() {
  return { statusCode: 204, headers: CORS, body: '' }
}

// ─── Request helpers ─────────────────────────────────────────────────────────

/** Parse JSON body safely; returns {} on empty / invalid */
export function getBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {}
  } catch {
    return {}
  }
}

/** Netlify query-string params (always an object, never null) */
export function getQuery(event) {
  return event.queryStringParameters || {}
}

/**
 * Extract a dynamic path segment from the *original* request URL.
 *
 * Netlify rewrites /api/items/:id to /.netlify/functions/items-id but
 * event.rawUrl still holds the original URL so we can parse it.
 *
 * /api/items/UUID            → segments[2] = UUID
 * /api/items/UUID/consume    → segments[2] = UUID
 */
export function getIdFromPath(event) {
  try {
    const pathname = event.rawUrl
      ? new URL(event.rawUrl).pathname
      : event.path || ''
    const parts = pathname.split('/').filter(Boolean)
    // parts: ['api','items','<uuid>'] or ['api','items','<uuid>','consume']
    return parts[2] || null
  } catch {
    return null
  }
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

/**
 * Checks that a Bearer token is present.
 * Returns { ok: true } or { ok: false, response } where response is a 401 json().
 */
export function requireAuth(event) {
  const auth =
    event.headers['authorization'] ||
    event.headers['Authorization'] ||
    ''
  if (!auth.startsWith('Bearer ')) {
    return { ok: false, response: json(401, { error: 'Unauthorized' }) }
  }
  return { ok: true }
}

// ─── Business logic helpers ───────────────────────────────────────────────────

export function computeStatus(expiryDate) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate); expiry.setHours(0, 0, 0, 0)
  const diff = Math.ceil((expiry - today) / 86_400_000)
  if (diff < 0)  return 'expired'
  if (diff <= 1) return 'today'
  if (diff <= 5) return 'soon'
  return 'fresh'
}

export function computeRemindAt(expiryDate, leadDays) {
  const d = new Date(expiryDate)
  d.setDate(d.getDate() - leadDays)
  return d.toISOString().split('T')[0]
}

export const DEFAULT_SETTINGS = {
  default_lead_time: '2',
  digest_time:       '08:00',
  push_enabled:      'false',
  sound_enabled:     'true',
  dark_mode:         'false',
  avg_cost_per_item: '3.00',
}
