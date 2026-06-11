import { useState, useEffect, useRef } from 'react'
import {
  Save, Bell, BellOff, Volume2, VolumeX,
  DollarSign, LogOut, MapPin, Locate, Search, Loader2, X, Mail, Smartphone,
} from 'lucide-react'
import { settingsApi, pushApi } from '../lib/api.js'
import {
  getAutoTimezone, getTzAbbr,
  getLocationFromCoords, searchCities,
} from '../lib/timezone.js'
import { usePushNotifications } from '../hooks/usePushNotifications.js'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────────────────────────
// LocationPicker — standalone sub-component
// Props:
//   value    = { location: string, timezone: string }
//   onChange = ({ location, timezone }) => void
// ─────────────────────────────────────────────────────────────────────────────
function LocationPicker({ value, onChange }) {
  const { location = '', timezone = '' } = value

  const [editing,       setEditing]       = useState(!location)   // start editing if nothing saved
  const [query,         setQuery]         = useState('')
  const [suggestions,   setSuggestions]   = useState([])
  const [detecting,     setDetecting]     = useState(false)
  const [searching,     setSearching]     = useState(false)
  const [error,         setError]         = useState('')
  const debounceRef     = useRef(null)
  const dropdownRef     = useRef(null)

  // When a saved location arrives after first render → exit editing mode
  useEffect(() => {
    if (location) setEditing(false)
  }, [location])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setSuggestions([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Search handler (debounced 400 ms) ────────────────────────────
  const handleSearch = e => {
    const q = e.target.value
    setQuery(q)
    setSuggestions([])
    setError('')

    clearTimeout(debounceRef.current)
    if (!q.trim() || q.trim().length < 2) { setSearching(false); return }

    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchCities(q)
        setSuggestions(results)
        if (!results.length) setError('No cities found, try a different spelling')
      } finally {
        setSearching(false)
      }
    }, 400)
  }

  // ── Select a city from the dropdown ─────────────────────────────
  const selectCity = city => {
    if (!city.timezone) {
      setError('Could not determine timezone for this city — try another')
      return
    }
    onChange({ location: city.displayName, timezone: city.timezone })
    setQuery('')
    setSuggestions([])
    setError('')
    setEditing(false)
  }

  // ── Detect via Geolocation API ───────────────────────────────────
  const handleDetect = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }
    setDetecting(true)
    setError('')

    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const result = await getLocationFromCoords(
            pos.coords.latitude,
            pos.coords.longitude
          )
          if (result.location) {
            onChange({ location: result.location, timezone: result.timezone })
            setEditing(false)
            setError('')
          } else {
            // API returned a timezone but couldn't name the city
            onChange({ location: '', timezone: result.timezone })
            setError('Location detected but city name unavailable. Search manually to add it.')
          }
        } finally {
          setDetecting(false)
        }
      },
      err => {
        setDetecting(false)
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location access denied. Please search for your city manually.')
        } else if (err.code === err.TIMEOUT) {
          setError('Location timed out. Please search for your city manually.')
        } else {
          setError('Could not get your location. Please search manually.')
        }
      },
      { timeout: 10_000, maximumAge: 300_000 }
    )
  }

  const cancelEdit = () => {
    setEditing(false)
    setQuery('')
    setSuggestions([])
    setError('')
  }

  // ── Saved state UI ───────────────────────────────────────────────
  if (!editing && location) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <MapPin size={14} style={{ color: 'var(--sage)' }} />
            <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>
              {location}
            </p>
          </div>
          {timezone && (
            <p className="text-xs mt-1 pl-5" style={{ color: 'var(--muted)' }}>
              Timezone: {timezone} ({getTzAbbr(timezone)})
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn-ghost text-sm flex-shrink-0"
          onClick={() => { setEditing(true); setQuery('') }}
        >
          Change
        </button>
      </div>
    )
  }

  // ── Editing state UI ─────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {/* Input row */}
      <div className="flex gap-2 items-start">
        {/* Search field + dropdown */}
        <div className="relative flex-1" ref={dropdownRef}>
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--muted)' }}
          />
          <input
            value={query}
            onChange={handleSearch}
            placeholder="Search city…"
            autoComplete="off"
            style={{ paddingLeft: '2.2rem', paddingRight: query ? '2rem' : undefined }}
          />
          {/* Clear query button */}
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setSuggestions([]); setError('') }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--muted)', lineHeight: 0 }}
            >
              <X size={14} />
            </button>
          )}

          {/* Suggestions dropdown */}
          {(searching || suggestions.length > 0) && (
            <div
              className="absolute left-0 right-0 mt-1 card shadow-xl overflow-hidden"
              style={{ top: '100%', zIndex: 30 }}
            >
              {searching ? (
                <div
                  className="flex items-center gap-2 px-3 py-3 text-sm"
                  style={{ color: 'var(--muted)' }}
                >
                  <Loader2 size={14} className="animate-spin" />
                  Searching…
                </div>
              ) : (
                suggestions.map((city, idx) => (
                  <button
                    key={city.id}
                    type="button"
                    // onMouseDown prevents input blur firing before onClick
                    onMouseDown={e => { e.preventDefault(); selectCity(city) }}
                    className="w-full text-left px-3 py-2.5 text-sm transition-colors"
                    style={{
                      color: 'var(--text)',
                      borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span className="font-medium">{city.name}</span>
                    {(city.admin1 || city.country) && (
                      <span style={{ color: 'var(--muted)' }}>
                        {' '}
                        {[city.admin1, city.country].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {city.timezone && (
                      <span
                        className="ml-1.5 text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--border)', color: 'var(--muted)' }}
                      >
                        {getTzAbbr(city.timezone)}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Detect button */}
        <button
          type="button"
          className="btn-ghost text-sm flex-shrink-0"
          onClick={handleDetect}
          disabled={detecting}
          title="Auto-detect my location"
          style={{ minWidth: 90 }}
        >
          {detecting ? (
            <><Loader2 size={14} className="animate-spin" /> Detecting</>
          ) : (
            <><Locate size={14} /> Detect</>
          )}
        </button>
      </div>

      {/* Error / info message */}
      {error && (
        <p className="text-xs flex items-start gap-1.5" style={{ color: 'var(--red)' }}>
          <span className="mt-0.5">⚠</span>
          <span>{error}</span>
        </p>
      )}

      {/* Current TZ hint while editing (so user can see what's active) */}
      {timezone && !error && (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Current timezone:{' '}
          <span className="font-medium">{timezone} ({getTzAbbr(timezone)})</span>
        </p>
      )}

      {/* Cancel button — only shown if there's already a saved location */}
      {location && (
        <button
          type="button"
          className="text-xs self-start underline"
          style={{ color: 'var(--muted)' }}
          onClick={cancelEdit}
        >
          ← Keep current location
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings page
// ─────────────────────────────────────────────────────────────────────────────
export default function Settings({ settings, updateSettings, user, onSignOut }) {
  const push = usePushNotifications()

  const [form, setForm] = useState({
    default_lead_time:   '2',
    digest_time:         '08:00',
    push_enabled:        'false',
    sound_enabled:       'true',
    avg_cost_per_item:   '3.00',
    timezone:            getAutoTimezone(),
    location:            '',
    email_notifications: 'true',
  })

  useEffect(() => {
    if (settings && Object.keys(settings).length) {
      setForm(f => ({
        ...f,
        ...settings,
        timezone: settings.timezone || getAutoTimezone(),
        location: settings.location || '',
      }))
    }
  }, [settings])

  const set    = key => e => setForm(f => ({ ...f, [key]: e.target.value }))
  const toggle = key => setForm(f => ({ ...f, [key]: f[key] === 'true' ? 'false' : 'true' }))

  // Called by LocationPicker when user picks a location
  const handleLocationChange = ({ location, timezone }) => {
    setForm(f => ({ ...f, location, timezone }))
  }

  const handleSave = async () => {
    try {
      await updateSettings(form)
      toast.success('Settings saved!')
    } catch {
      toast.error('Failed to save settings')
    }
  }

  const handleEnablePush = async () => {
    const ok = await push.subscribe()
    if (ok) {
      setForm(f => ({ ...f, push_enabled: 'true' }))
      toast.success('Push notifications enabled!')
    } else if (push.error) {
      toast.error(push.error)
    }
  }

  const handleDisablePush = async () => {
    await push.unsubscribe()
    setForm(f => ({ ...f, push_enabled: 'false' }))
    toast.success('Push notifications disabled')
  }

  const handleSignOut = async () => {
    if (!confirm('Sign out?')) return
    await onSignOut()
    toast.success('Signed out')
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-6 pb-safe">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Settings</h2>

      {/* ── Account ── */}
      <div className="card p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Account</p>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>{user?.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="btn-ghost text-sm flex-shrink-0"
          style={{ color: 'var(--red)' }}
        >
          <LogOut size={15} /> Sign Out
        </button>
      </div>

      {/* ── Location ── */}
      <div className="card p-5 flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <MapPin size={17} style={{ color: 'var(--sage)' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Your Location</h3>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Used for accurate expiry countdowns and notification timing
          </p>
        </div>

        <LocationPicker
          value={{ location: form.location, timezone: form.timezone }}
          onChange={handleLocationChange}
        />
      </div>

      {/* ── Notifications ── */}
      <div className="card p-5 flex flex-col gap-4">
        <h3 className="font-semibold" style={{ color: 'var(--text)' }}>🔔 Notifications</h3>

        {/* Email alerts */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Mail size={14} style={{ color: 'var(--sage)' }} />
              <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>Email Alerts</p>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Daily digest of expiring items via Resend
            </p>
          </div>
          <button
            onClick={() => {
              const next = form.email_notifications === 'true' ? 'false' : 'true'
              setForm(f => ({ ...f, email_notifications: next }))
            }}
            className={form.email_notifications === 'true' ? 'btn-primary text-sm flex-shrink-0' : 'btn-ghost text-sm flex-shrink-0'}
          >
            {form.email_notifications === 'true' ? <><Mail size={13} /> On</> : <><Mail size={13} /> Off</>}
          </button>
        </div>

        {/* Push notifications */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Smartphone size={14} style={{ color: 'var(--sage)' }} />
              <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>Push Notifications</p>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Alerts even when the app is closed
            </p>
            {!push.isSupported && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                Not supported in this browser
              </p>
            )}
            {push.error && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--red)' }}>{push.error}</p>
            )}
          </div>
          {push.isSupported && (
            push.isSubscribed || form.push_enabled === 'true' ? (
              <button
                onClick={handleDisablePush}
                disabled={push.loading}
                className="btn-ghost text-sm flex-shrink-0"
              >
                {push.loading ? <Loader2 size={13} className="animate-spin" /> : <BellOff size={13} />}
                {push.loading ? 'Disabling…' : 'Disable'}
              </button>
            ) : (
              <button
                onClick={handleEnablePush}
                disabled={push.loading}
                className="btn-primary text-sm flex-shrink-0"
              >
                {push.loading ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
                {push.loading ? 'Enabling…' : 'Enable'}
              </button>
            )
          )}
        </div>

        {/* Remind lead time (applies to both email and push) */}
        <div>
          <label className="form-label">
            ⏰ Remind me — days before expiry
          </label>
          <select value={form.default_lead_time} onChange={set('default_lead_time')}>
            {[1, 2, 3, 5, 7, 14].map(d => (
              <option key={d} value={d}>{d} day{d > 1 ? 's' : ''} before</option>
            ))}
          </select>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Applies to both email digests and push alerts
          </p>
        </div>

        {/* Sound toggle */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>In-app Sounds</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Play a sound for in-app alerts</p>
          </div>
          <button
            onClick={() => toggle('sound_enabled')}
            className="btn-ghost flex-shrink-0"
            style={{ padding: '8px' }}
          >
            {form.sound_enabled === 'true' ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </div>

      {/* ── Waste Tracking ── */}
      <div className="card p-5 flex flex-col gap-4">
        <h3 className="font-semibold" style={{ color: 'var(--text)' }}>💰 Waste Tracking</h3>
        <div>
          <label className="form-label">Average cost per item ($)</label>
          <div className="relative">
            <DollarSign
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--muted)' }}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.avg_cost_per_item}
              onChange={set('avg_cost_per_item')}
              style={{ paddingLeft: '2rem' }}
            />
          </div>
        </div>
      </div>

      <button className="btn-primary self-start px-6" onClick={handleSave}>
        <Save size={15} /> Save Settings
      </button>
    </div>
  )
}
