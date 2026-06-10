import { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { Moon, Sun, BarChart2, Settings as SettingsIcon, Home, Loader2 } from 'lucide-react'

import { useAuth } from './hooks/useAuth.js'
import { useSettings } from './hooks/useSettings.js'
import { useNotifications } from './hooks/useNotifications.js'

import AuthPage from './components/AuthPage.jsx'
import Dashboard from './components/Dashboard.jsx'
import NotificationBell from './components/NotificationBell.jsx'
import OnboardingModal from './components/OnboardingModal.jsx'
import StatsWidget from './components/StatsWidget.jsx'
import Settings from './pages/Settings.jsx'
import Stats from './pages/Stats.jsx'

const ONBOARDING_KEY = 'fg_onboarded_v2'

export default function App() {
  const { session, user, loading: authLoading, signOut } = useAuth()
  const { settings, loading: settingsLoading, updateSetting, updateSettings } =
    useSettings(session)
  const { notifications, unreadCount, markAllRead, clearAll } =
    useNotifications(session)

  const [page, setPage] = useState('home')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [statsKey, setStatsKey] = useState(0)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  // Dark mode
  const darkMode = settings.dark_mode === 'true'
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Show onboarding for new sessions
  useEffect(() => {
    if (session && !settingsLoading && !localStorage.getItem(ONBOARDING_KEY)) {
      setShowOnboarding(true)
    }
  }, [session, settingsLoading])

  const closeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowOnboarding(false)
  }

  // ── Loading spinner ─────────────────────────────────────────────
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

  // ── Auth gate ───────────────────────────────────────────────────
  if (!session) return <AuthPage />

  // ── Main app ────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          },
          duration: 3000,
        }}
      />

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🧊</span>
            <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--text)' }}>
              FridgeGuard
            </span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {[
              { id: 'home',     icon: <Home size={16} />,         label: 'Fridge'   },
              { id: 'stats',    icon: <BarChart2 size={16} />,    label: 'Stats'    },
              { id: 'settings', icon: <SettingsIcon size={16} />, label: 'Settings' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: page === item.id ? 'rgba(124,174,122,0.15)' : 'transparent',
                  color: page === item.id ? 'var(--sage)' : 'var(--muted)',
                }}
              >
                {item.icon}
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllRead={markAllRead}
              onClear={clearAll}
            />
            <button
              onClick={() => updateSetting('dark_mode', darkMode ? 'false' : 'true')}
              className="btn-ghost"
              style={{ padding: '8px' }}
              title="Toggle dark mode"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {page === 'home' && (
          <div className="flex flex-col gap-6">
            <StatsWidget refreshKey={statsKey} session={session} />
            <Dashboard
              session={session}
              onStatsChange={() => setStatsKey(k => k + 1)}
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

      {/* ── Onboarding ── */}
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
