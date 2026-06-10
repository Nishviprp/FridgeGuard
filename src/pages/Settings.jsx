import { useState, useEffect, useMemo } from 'react'
import { Save, Bell, BellOff, Volume2, VolumeX, DollarSign, LogOut, Globe } from 'lucide-react'
import { settingsApi, pushApi } from '../lib/api.js'
import { getAutoTimezone, getGroupedTimezones, REGION_ORDER } from '../lib/timezone.js'
import toast from 'react-hot-toast'

export default function Settings({ settings, updateSettings, user, onSignOut }) {
  const [form, setForm] = useState({
    default_lead_time: '2',
    digest_time:       '08:00',
    push_enabled:      'false',
    sound_enabled:     'true',
    avg_cost_per_item: '3.00',
    timezone:          getAutoTimezone(),
  })

  useEffect(() => {
    if (settings && Object.keys(settings).length) {
      setForm(f => ({
        ...f,
        ...settings,
        // If no timezone saved yet, auto-detect
        timezone: settings.timezone || getAutoTimezone(),
      }))
    }
  }, [settings])

  // Build grouped timezone options once
  const tzGroups = useMemo(() => {
    const grouped = getGroupedTimezones()
    return REGION_ORDER
      .filter(r => grouped[r])
      .map(r => ({ region: r, zones: grouped[r] }))
  }, [])

  const set    = key => e => setForm(f => ({ ...f, [key]: e.target.value }))
  const toggle = key => setForm(f => ({ ...f, [key]: f[key] === 'true' ? 'false' : 'true' }))

  const handleSave = async () => {
    try {
      await updateSettings(form)
      toast.success('Settings saved!')
    } catch {
      toast.error('Failed to save settings')
    }
  }

  const requestNotifications = async () => {
    if (!('Notification' in window)) { toast.error('Browser does not support notifications'); return }
    const perm = await Notification.requestPermission()
    if (perm === 'granted') {
      setForm(f => ({ ...f, push_enabled: 'true' }))
      await settingsApi.update({ push_enabled: 'true' })
      toast.success('Push notifications enabled!')
    } else {
      toast.error('Permission denied. Check browser settings.')
    }
  }

  const disableNotifications = async () => {
    setForm(f => ({ ...f, push_enabled: 'false' }))
    await pushApi.remove().catch(() => {})
    toast.success('Notifications disabled')
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

      {/* ── Timezone ── */}
      <div className="card p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Globe size={18} style={{ color: 'var(--sage)' }} />
          <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Timezone</h3>
        </div>
        <div>
          <label className="form-label">Your timezone</label>
          <select value={form.timezone} onChange={set('timezone')}>
            {tzGroups.map(({ region, zones }) => (
              <optgroup key={region} label={region}>
                {zones.map(tz => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
            Expiry countdowns and daily digests use this timezone.
            Auto-detected as <strong>{getAutoTimezone()}</strong>.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost text-sm self-start"
          onClick={() => setForm(f => ({ ...f, timezone: getAutoTimezone() }))}
        >
          Reset to auto-detected
        </button>
      </div>

      {/* ── Reminders ── */}
      <div className="card p-5 flex flex-col gap-4">
        <h3 className="font-semibold" style={{ color: 'var(--text)' }}>⏰ Reminders</h3>
        <div>
          <label className="form-label">Default reminder lead time</label>
          <select value={form.default_lead_time} onChange={set('default_lead_time')}>
            {[1, 2, 3, 5, 7, 14].map(d => (
              <option key={d} value={d}>{d} day{d > 1 ? 's' : ''} before expiry</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Daily digest time (in your timezone)</label>
          <input type="time" value={form.digest_time} onChange={set('digest_time')} />
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            The edge function runs in UTC — it converts using your saved timezone.
          </p>
        </div>
      </div>

      {/* ── Notifications ── */}
      <div className="card p-5 flex flex-col gap-4">
        <h3 className="font-semibold" style={{ color: 'var(--text)' }}>🔔 Notifications</h3>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>
              Browser Push Notifications
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Alerts even when the app is in background
            </p>
          </div>
          {form.push_enabled === 'true' ? (
            <button onClick={disableNotifications} className="btn-ghost text-sm flex-shrink-0">
              <BellOff size={15} /> Disable
            </button>
          ) : (
            <button onClick={requestNotifications} className="btn-primary text-sm flex-shrink-0">
              <Bell size={15} /> Enable
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>Notification Sounds</p>
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
