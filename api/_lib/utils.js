/** Compute item freshness status from expiry date */
export function computeStatus(expiryDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= 1) return 'today'
  if (diffDays <= 5) return 'soon'
  return 'fresh'
}

/** Compute the date to trigger a reminder (expiry minus lead days) */
export function computeRemindAt(expiryDate, leadDays) {
  const d = new Date(expiryDate)
  d.setDate(d.getDate() - leadDays)
  return d.toISOString().split('T')[0]
}

/** Add CORS headers — all on same Vercel domain so mainly for dev */
export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

/** Guard: ensure Authorization header present, else 401 */
export function requireAuth(req, res) {
  const auth = req.headers['authorization']
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

/** Default settings for new users */
export const DEFAULT_SETTINGS = {
  default_lead_time: '2',
  digest_time: '08:00',
  push_enabled: 'false',
  sound_enabled: 'true',
  dark_mode: 'false',
  avg_cost_per_item: '3.00',
}
