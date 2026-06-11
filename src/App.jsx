import { useState, useEffect, useCallback } from 'react'
import { Toaster } from 'react-hot-toast'
import { Moon, Sun, BarChart2, Settings as SettingsIcon, Home, Loader2 } from 'lucide-react'

import { useAuth }          from './hooks/useAuth.js'
import { useSettings }      from './hooks/useSettings.js'
import { useNotifications } from './hooks/useNotifications.js'
import { getAutoTimezone }  from './lib/timezone.js'
import { itemsApi }         from './lib/api.js'

import AuthPage          from './components/AuthPage.jsx'
import Dashboard         from './components/Dashboard.jsx'
import NotificationBell  from './components/NotificationBell.jsx'
import OnboardingModal   from './components/OnboardingModal.jsx'
import StatsWidget       from './components/StatsWidget.jsx'
import Settings          from './pages/Settings.jsx'
import Stats             from './pages/Stats.jsx'

const ONBOARDING_KEY = 'fg_onboarded_v2'

export default function App() {
  const { session, user, loading: authLoading, signOut } = useAuth()
  const { settings, loading: settingsLoading, updateSetting, updateSettings } = useSettings(session)
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications(session)

  const [page,           setPage]           = useState('home')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [statsKey,       setStatsKey]       = useState(0)
  const [todayCount,     setTodayCount]     = useState(0)   // items expiring today

  // Derive timezone from settings (fallback to browser auto-detect)
  const timezone = settings.timezone || getAutoTimezone()

  // Dark mode
  const darkMode = settings.dark_mode === 'true'
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Register service worker for push notifications
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }
  }, [])

  // Fetch "expiring today" count for the banner
  const refreshTodayCount = useCallback(async () => {
    if (!session) return
    try {
      const items = await itemsApi.getAll({ status: 'today' })
      setTodayCount(Array.isArray(items) ? items.length : 0)
    } catch { /* silent */ }
  }, [session])

  useEffect(() => { refreshTodayCount() }, [refreshTodayCount])

  // First-run onboarding
  useEffect(() => {
    if (session && !settingsLoading && !localStorage.getItem(ONBOARDING_KEY)) {
      setShowOnboarding(true)
    }
  }, [session, settingsLoading])

  const closeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowOnboarding(false)
  }

  // ── Loading ─────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">🧊</span>
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--sage)' }} />
        </div>
      </div>
    )
  }

  // ── Auth gate ────────────────────────────────────────────────────
  if (!session) return <AuthPage />

  // ── Main app ─────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            fontSize: '0.875rem',
          },
          duration: 3000,
        }}
      />

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div
          className="max-w-6xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2"
        >
          {/* Logo — hide wordmark on tiny screens */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-2xl">🧊</span>
            <span
              className="font-bold text-lg tracking-tight hidden xs:block"
              style={{ color: 'var(--text)' }}
            >
              FridgeGuard
            </span>
          </div>

          {/* Nav — icons always visible, labels hidden on mobile */}
          <nav className="flex items-center gap-0.5 sm:gap-1">
            {[
              { id: 'home',     icon: <Home size={18} />,         label: 'Fridge'   },
              { id: 'stats',    icon: <BarChart2 size={18} />,    label: 'Stats'    },
              { id: 'settings', icon: <SettingsIcon size={18} />, label: 'Settings' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className="flex items-center gap-1.5 rounded-lg font-medium transition-colors"
                style={{
                  padding:     '8px 10px',
                  minHeight:   44,
                  background:  page === item.id ? 'rgba(124,174,122,0.15)' : 'transparent',
                  color:       page === item.id ? 'var(--sage)' : 'var(--muted)',
                  fontSize:   '0.875rem',
                }}
                aria-label={item.label}
              >
                {item.icon}
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllRead={markAllRead}
              onClear={clearAll}
            />
            <button
              onClick={() => updateSetting('dark_mode', darkMode ? 'false' : 'true')}
              className="btn-ghost"
              style={{ padding: '8px', minHeight: 44, minWidth: 44 }}
              title="Toggle dark mode"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main
        className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6"
        style={{ paddingBottom: `max(1.5rem, env(safe-area-inset-bottom))` }}
      >
        {page === 'home' && (
          <div className="flex flex-col gap-5 sm:gap-6">
            <StatsWidget refreshKey={statsKey} session={session} />

            {/* ── Expiry-today banner ── */}
            {todayCount > 0 && (
              <div
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border fade-in"
                style={{ background: '#FEF2F2', borderColor: '#FECACA' }}
              >
                <p className="text-sm font-medium" style={{ color: '#991B1B' }}>
                  ⚠️ {todayCount} item{todayCount !== 1 ? 's' : ''} expire{todayCount === 1 ? 's' : ''} today!
                </p>
                <button
                  onClick={() => setPage('home')}
                  className="text-xs font-semibold underline flex-shrink-0"
                  style={{ color: '#E05C5C' }}
                >
                  View →
                </button>
              </div>
            )}

            <Dashboard
              session={session}
              timezone={timezone}
              onStatsChange={() => { setStatsKey(k => k + 1); refreshTodayCount() }}
            />
          </div>
        )}
        {page === 'stats' && <Stats session={session} />}
        {page === 'settings' && (
          <Settings
            settings={settings}
            updateSettings={updateSettings}
            user={user}
            onSignOut={signOut}
          />
        )}
      </main>

      {showOnboarding && (
        <OnboardingModal
          onClose={closeOnboarding}
          onAddItems={closeOnboarding}
          onScanBill={closeOnboarding}
        />
      )}
    </div>
  )
}
