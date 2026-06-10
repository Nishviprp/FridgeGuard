import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Loader2, LogIn, UserPlus, Eye, EyeOff, Mail, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Defined at TOP LEVEL so React sees a stable reference across renders ──────
// If this were inside AuthPage, every keystroke would create a new component
// identity → React unmounts+remounts the input → focus lost after each character.

function PwField({ label, value, onChange, show, onToggle, autoComplete, placeholder }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder || '••••••••'}
          autoComplete={autoComplete}
          required
          style={{ paddingRight: '2.75rem' }}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--muted)', lineHeight: 0 }}
          tabIndex={-1}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )
}

/**
 * Views:
 *  tab  = 'login' | 'signup'         (which tab is shown)
 *  step = 'form' | 'forgot' | 'resetSent' | 'verifyEmail'
 */
export default function AuthPage() {
  const [tab,            setTab]            = useState('login')
  const [step,           setStep]           = useState('form')
  const [email,          setEmail]          = useState('')
  const [password,       setPassword]       = useState('')
  const [confirmPw,      setConfirmPw]      = useState('')
  const [showPw,         setShowPw]         = useState(false)
  const [showConfirmPw,  setShowConfirmPw]  = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [signedUpEmail,  setSignedUpEmail]  = useState('')

  // Switch tabs and reset step/passwords
  const switchTab = (t) => {
    setTab(t)
    setStep('form')
    setPassword('')
    setConfirmPw('')
    setShowPw(false)
    setShowConfirmPw(false)
  }

  // ── Login submit ──────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // auth state change triggers App to render the main app automatically
    } catch (err) {
      toast.error(err.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  // ── Signup submit ─────────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault()
    if (password !== confirmPw) {
      toast.error("Passwords don't match")
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      setSignedUpEmail(email)
      setStep('verifyEmail')
    } catch (err) {
      toast.error(err.message || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  // ── Forgot password submit ────────────────────────────────────
  const handleForgot = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setStep('resetSent')
    } catch (err) {
      toast.error(err.message || 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  Confirmation screens (no tab bar)
  // ═══════════════════════════════════════════════════════════════
  if (step === 'verifyEmail') {
    return (
      <AuthShell>
        <div className="text-center py-2 flex flex-col items-center gap-4 fade-in">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
            style={{ background: 'rgba(124,174,122,0.12)' }}
          >
            ✉️
          </div>
          <div>
            <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>
              Check your inbox!
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              We sent a verification link to{' '}
              <strong style={{ color: 'var(--text)' }}>{signedUpEmail}</strong>.
              <br />
              Click it to verify your account, then come back here to log in.
            </p>
          </div>
          <button
            className="btn-primary justify-center w-full mt-2"
            onClick={() => { switchTab('login') }}
          >
            <ArrowLeft size={15} /> Back to Login
          </button>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Didn't receive it? Check your spam folder or{' '}
            <button
              className="underline"
              style={{ color: 'var(--sage)' }}
              onClick={() => supabase.auth.resend({ type: 'signup', email: signedUpEmail })}
            >
              resend
            </button>.
          </p>
        </div>
      </AuthShell>
    )
  }

  if (step === 'resetSent') {
    return (
      <AuthShell>
        <div className="text-center py-2 flex flex-col items-center gap-4 fade-in">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
            style={{ background: 'rgba(242,166,90,0.12)' }}
          >
            📬
          </div>
          <div>
            <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text)' }}>
              Reset link sent!
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              We emailed a password reset link to{' '}
              <strong style={{ color: 'var(--text)' }}>{email}</strong>.
              <br />
              Follow the link to set a new password.
            </p>
          </div>
          <button
            className="btn-ghost justify-center w-full mt-2"
            onClick={() => { setStep('form'); setTab('login') }}
          >
            <ArrowLeft size={15} /> Back to Login
          </button>
        </div>
      </AuthShell>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  //  Main card with tabs
  // ═══════════════════════════════════════════════════════════════
  return (
    <AuthShell>
      {/* ── Tab bar ── */}
      <div
        className="flex rounded-xl p-1 mb-6"
        style={{ background: 'var(--border)' }}
      >
        {[
          { id: 'login',  label: 'Sign In'        },
          { id: 'signup', label: 'Create Account' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === t.id ? 'var(--surface)' : 'transparent',
              color:      tab === t.id ? 'var(--sage)' : 'var(--muted)',
              boxShadow:  tab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Login form ── */}
      {tab === 'login' && step === 'form' && (
        <form key="login" onSubmit={handleLogin} className="flex flex-col gap-4 fade-in">
          <div>
            <label className="form-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <PwField
            label="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            show={showPw}
            onToggle={() => setShowPw(v => !v)}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="text-xs text-left -mt-2"
            style={{ color: 'var(--sage)' }}
            onClick={() => setStep('forgot')}
          >
            Forgot your password?
          </button>
          <button
            type="submit"
            className="btn-primary justify-center py-3 mt-1"
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <><LogIn size={16} /> Sign In</>}
          </button>
          <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
            Don't have an account?{' '}
            <button
              type="button"
              className="font-semibold underline"
              style={{ color: 'var(--sage)' }}
              onClick={() => switchTab('signup')}
            >
              Sign Up
            </button>
          </p>
        </form>
      )}

      {/* ── Forgot password inline ── */}
      {tab === 'login' && step === 'forgot' && (
        <form key="forgot" onSubmit={handleForgot} className="flex flex-col gap-4 fade-in">
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => setStep('form')}
              style={{ color: 'var(--muted)', lineHeight: 0 }}
            >
              <ArrowLeft size={18} />
            </button>
            <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
              Reset your password
            </p>
          </div>
          <p className="text-sm -mt-1" style={{ color: 'var(--muted)' }}>
            Enter your email address and we'll send you a reset link.
          </p>
          <div>
            <label className="form-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <button
            type="submit"
            className="btn-primary justify-center py-3"
            disabled={loading}
          >
            {loading
              ? <Loader2 size={16} className="animate-spin" />
              : <><Mail size={16} /> Send Reset Link</>
            }
          </button>
          <button
            type="button"
            className="text-xs text-center"
            style={{ color: 'var(--muted)' }}
            onClick={() => setStep('form')}
          >
            ← Back to sign in
          </button>
        </form>
      )}

      {/* ── Sign Up form ── */}
      {tab === 'signup' && (
        <form key="signup" onSubmit={handleSignup} className="flex flex-col gap-4 fade-in">
          <div>
            <label className="form-label">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <PwField
            label="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            show={showPw}
            onToggle={() => setShowPw(v => !v)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          <PwField
            label="Confirm Password"
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            show={showConfirmPw}
            onToggle={() => setShowConfirmPw(v => !v)}
            autoComplete="new-password"
            placeholder="Repeat your password"
          />
          {/* Password match indicator */}
          {confirmPw && (
            <p
              className="text-xs -mt-2"
              style={{ color: password === confirmPw ? '#15803D' : 'var(--red)' }}
            >
              {password === confirmPw ? '✓ Passwords match' : '✗ Passwords do not match'}
            </p>
          )}
          <button
            type="submit"
            className="btn-primary justify-center py-3 mt-1"
            disabled={loading || (confirmPw && password !== confirmPw)}
          >
            {loading
              ? <Loader2 size={16} className="animate-spin" />
              : <><UserPlus size={16} /> Create Account</>
            }
          </button>
          <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
            Already have an account?{' '}
            <button
              type="button"
              className="font-semibold underline"
              style={{ color: 'var(--sage)' }}
              onClick={() => switchTab('login')}
            >
              Sign In
            </button>
          </p>
        </form>
      )}
    </AuthShell>
  )
}

// ── Shell wrapper (logo + card) ───────────────────────────────────────────────
function AuthShell({ children }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-7">
          <span className="text-6xl block mb-3">🧊</span>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text)' }}>FridgeGuard</h1>
          <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>
            Beat food waste. Save money. Eat fresher.
          </p>
        </div>

        <div className="card p-6 shadow-sm">{children}</div>

        <p className="text-center text-xs mt-5" style={{ color: 'var(--muted)' }}>
          🔒 Your fridge is private. Data encrypted at rest.
        </p>
      </div>
    </div>
  )
}
