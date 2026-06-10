import { useState } from 'react'
import { ChevronRight, Bell, Plus, ScanLine } from 'lucide-react'
import { settingsApi } from '../lib/api.js'
import { supabase } from '../lib/supabase.js'

export default function OnboardingModal({ onClose, onAddItems, onScanBill }) {
  const [step, setStep] = useState(1)
  const [leadTime, setLeadTime] = useState('2')
  const [digestTime, setDigestTime] = useState('08:00')
  const [requesting, setRequesting] = useState(false)
  const [notifStatus, setNotifStatus] = useState('idle')

  const savePrefs = async () => {
    await settingsApi.update({ default_lead_time: leadTime, digest_time: digestTime })
    setStep(3)
  }

  const requestNotifications = async () => {
    setRequesting(true)
    try {
      const perm = await Notification.requestPermission()
      setNotifStatus(perm)
      if (perm === 'granted') {
        await settingsApi.update({ push_enabled: 'true' })
      }
    } catch {
      setNotifStatus('denied')
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <div className="text-center mb-6">
          <span className="text-5xl">🧊</span>
          <h1 className="text-2xl font-bold mt-2" style={{ color: 'var(--text)' }}>
            Welcome to FridgeGuard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Beat food waste. Save money. Eat fresher.
          </p>
        </div>

        {/* Step dots */}
        <div className="flex items-center gap-2 mb-6 justify-center">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: s === step ? 24 : 8,
                background: s <= step ? 'var(--sage)' : 'var(--border)',
              }}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-lg text-center" style={{ color: 'var(--text)' }}>
              What's in your fridge?
            </h3>
            <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
              Add items manually or scan a grocery receipt.
            </p>
            <button className="btn-primary justify-center py-3" onClick={() => { onClose(); onAddItems() }}>
              <Plus size={18} /> Add Items Manually
            </button>
            <button className="btn-ghost justify-center py-3" onClick={() => { onClose(); onScanBill() }}>
              <ScanLine size={18} /> Scan Grocery Bill
            </button>
            <button
              className="text-sm text-center underline mt-1"
              style={{ color: 'var(--muted)' }}
              onClick={() => setStep(2)}
            >
              Skip for now →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-lg text-center" style={{ color: 'var(--text)' }}>
              Set your reminder preferences
            </h3>
            <div>
              <label className="form-label">Default reminder (days before expiry)</label>
              <select value={leadTime} onChange={e => setLeadTime(e.target.value)}>
                {[1,2,3,5,7].map(d => (
                  <option key={d} value={d}>{d} day{d > 1 ? 's' : ''} before</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Daily digest time</label>
              <input type="time" value={digestTime} onChange={e => setDigestTime(e.target.value)} />
            </div>
            <button className="btn-primary justify-center py-3 mt-2" onClick={savePrefs}>
              Save Preferences <ChevronRight size={16} />
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4 items-center text-center">
            <Bell size={40} style={{ color: 'var(--sage)' }} />
            <h3 className="font-semibold text-lg" style={{ color: 'var(--text)' }}>
              Enable Push Notifications
            </h3>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Get browser alerts before your food expires.
            </p>
            {notifStatus === 'granted' ? (
              <p className="font-semibold text-sm" style={{ color: 'var(--sage)' }}>✅ Enabled!</p>
            ) : notifStatus === 'denied' ? (
              <p className="text-sm" style={{ color: 'var(--red)' }}>
                Blocked. Enable notifications in your browser settings.
              </p>
            ) : (
              <button className="btn-primary py-3 px-8" onClick={requestNotifications} disabled={requesting}>
                <Bell size={16} /> {requesting ? 'Requesting…' : 'Enable Notifications'}
              </button>
            )}
            <button className="btn-ghost mt-1" onClick={onClose}>
              {notifStatus === 'granted' ? 'Get Started! 🎉' : 'Skip & Get Started'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
