/**
 * Timezone utilities for FridgeGuard.
 *
 * Key design decisions:
 *  - Expiry dates are stored as plain DATE strings (YYYY-MM-DD), no time component.
 *  - "Days left" depends on what "today" is in the user's local timezone.
 *  - We use Intl APIs so no extra libraries are needed.
 */

/** User's detected timezone, e.g. "Asia/Kolkata" */
export function getAutoTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

/**
 * Returns the short timezone abbreviation for display, e.g. "IST", "EST", "CET".
 * Falls back to the IANA name if abbreviation can't be extracted.
 */
export function getTzAbbr(timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(new Date())
    return parts.find(p => p.type === 'timeZoneName')?.value ?? timezone
  } catch {
    return timezone
  }
}

/**
 * Days remaining until expiryDate (YYYY-MM-DD), evaluated in the user's timezone.
 *
 * Example: it's 11:30 PM UTC on June 10 but already June 11 in IST.
 * A user in IST should see "today" as June 11, not June 10.
 *
 * Returns a negative number when already expired.
 */
export function getDaysLeftInTz(expiryDate, timezone) {
  try {
    // Get today as YYYY-MM-DD in the user's timezone (en-CA locale gives this format)
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
    const todayMs  = new Date(todayStr + 'T00:00:00').getTime()
    const expiryMs = new Date(expiryDate + 'T00:00:00').getTime()
    return Math.ceil((expiryMs - todayMs) / 86_400_000)
  } catch {
    // Fallback: use browser local time
    const today  = new Date(); today.setHours(0, 0, 0, 0)
    const expiry = new Date(expiryDate + 'T00:00:00')
    return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000)
  }
}

/**
 * Returns all IANA timezones grouped by region.
 * Falls back to a curated list if Intl.supportedValuesOf isn't available.
 */
export function getGroupedTimezones() {
  let zones
  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch {
    // Fallback for older browsers
    zones = FALLBACK_TIMEZONES
  }

  const groups = {}
  for (const tz of zones) {
    const region = tz.includes('/') ? tz.split('/')[0] : 'Other'
    if (!groups[region]) groups[region] = []
    groups[region].push(tz)
  }
  return groups
}

// ─── Location APIs ───────────────────────────────────────────────────────────

/**
 * Reverse-geocode lat/lng → { location, timezone, city, region, country }
 *
 * Uses BigDataCloud (free, no key needed):
 *   https://api.bigdatacloud.net/data/reverse-geocode-client
 *
 * On any failure silently falls back to browser Intl timezone with an empty
 * location string so nothing downstream breaks.
 */
export async function getLocationFromCoords(lat, lng) {
  try {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${lat}&longitude=${lng}&localityLanguage=en`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    const city    = data.city || data.locality || ''
    const region  = data.principalSubdivision || ''
    const country = data.countryName || ''
    // BigDataCloud returns timezone directly — prefer it over Intl
    const timezone =
      data.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone

    const location = [city, region, country].filter(Boolean).join(', ')
    return { location, timezone, city, region, country }
  } catch {
    // Silent fallback — Intl gives the browser's local timezone
    return {
      location: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      city: '', region: '', country: '',
    }
  }
}

/**
 * City autocomplete via Open-Meteo geocoding API (free, no key):
 *   https://geocoding-api.open-meteo.com/v1/search
 *
 * Returns up to 5 results, each with:
 *   { id, name, admin1, country, timezone, displayName }
 *
 * Returns [] on empty query, no results, or any network error (silent).
 */
export async function searchCities(query) {
  if (!query?.trim() || query.trim().length < 2) return []

  try {
    const url =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${encodeURIComponent(query.trim())}&count=5&language=en&format=json`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    if (!Array.isArray(data.results) || !data.results.length) return []

    return data.results.map(r => ({
      id:          r.id,
      name:        r.name         || '',
      admin1:      r.admin1       || '',
      country:     r.country      || '',
      timezone:    r.timezone     || '',
      lat:         r.latitude,
      lng:         r.longitude,
      // Pre-built display string, e.g. "Mumbai, Maharashtra, India"
      displayName: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    }))
  } catch {
    return []   // silent — caller shows "No cities found" via empty array
  }
}

// ─── Dropdown helpers (kept for any future use) ───────────────────────────────

// Prioritised region order for the dropdown
export const REGION_ORDER = [
  'America', 'Europe', 'Asia', 'Africa',
  'Australia', 'Pacific', 'Atlantic', 'Indian', 'Arctic', 'Antarctica', 'Etc', 'Other',
]

// Curated fallback list for environments where Intl.supportedValuesOf isn't available
const FALLBACK_TIMEZONES = [
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Toronto','America/Vancouver','America/Sao_Paulo','America/Buenos_Aires',
  'America/Mexico_City','America/Lima',
  'Europe/London','Europe/Paris','Europe/Berlin','Europe/Madrid','Europe/Rome',
  'Europe/Amsterdam','Europe/Stockholm','Europe/Warsaw','Europe/Istanbul',
  'Europe/Moscow','Europe/Kyiv',
  'Asia/Kolkata','Asia/Dubai','Asia/Tokyo','Asia/Shanghai','Asia/Singapore',
  'Asia/Seoul','Asia/Bangkok','Asia/Jakarta','Asia/Karachi','Asia/Dhaka',
  'Asia/Riyadh','Asia/Tehran','Asia/Colombo',
  'Africa/Cairo','Africa/Lagos','Africa/Johannesburg','Africa/Nairobi',
  'Australia/Sydney','Australia/Melbourne','Australia/Perth','Australia/Brisbane',
  'Pacific/Auckland','Pacific/Honolulu','Pacific/Fiji',
  'UTC',
]
