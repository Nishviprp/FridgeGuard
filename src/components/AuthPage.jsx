import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { Loader2, LogIn, UserPlus, Eye, EyeOff, Mail, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Defined at TOP LEVEL — stable reference prevents focus-loss bug ───────────
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
 * State machine:
 *  tab  = 'login' | 'signup'
 *  step = 'form'  | 'forgot' | 'resetSent' | 'verifyEmail'
 */
export default function AuthPage() {
  const [tab,             setTab]             = useState('login')
  const [step,            setStep]            = useState('form')
  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPw,       setConfirmPw]       = useState('')
  const [showPw,          setShowPw]          = useState(false)
  const [showConfirmPw,   setShowConfirmPw]   = useState(false)
  const [loading,         setLoading]         = useState(false)
  const [signedUpEmail,   setSignedUpEmail]   = useState('')

  // Resend with 60-second cooldown
  const [resendLoading,   setResendLoading]   = useState(false)
  const [resendCooldown,  setResendCooldown]  = useState(0)

  // Login-tab feedback
  const [loginBanner,     setLoginBanner]     = useState('')    // 'verified' | ''
  const [loginError,      setLoginError]      = useState('')    // inline error text
  const [unverifiedEmail, setUnverifiedEmail] = useState('')    // email to resend to

  // ── Cooldown timer: chains setTimeout, each tick decrements by 1 ───────────
  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setTimeout(() => setResendCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearTimeout(id)
  }, [resendCooldown])

  // ── On mount: detect Supabase verification callback in URL ──────────────────
  // After clicking the email link, Supabase redirects back with:
  //   {origin}/#access_token=...&type=signup
  useEffect(() => {
    const hash         = window.location.hash.slice(1)   // strip leading #
    const hashParams   = new URLSearchParams(hash)
    const searchParams = new URLSearchParams(window.location.search)

    const type        = hashParams.get('type')         || searchParams.get('type')
    const accessToken = hashParams.get('access_token') || searchParams.get('access_token')

    if (type === 'signup' && accessToken) {
      // Clear the token from the URL bar (tidy + security)
      window.history.replaceState({}, '', window.location.pathname)

      // Show success banner on the login tab
      setLoginBanner('verified')
      setTab('login')
      setStep('form')

      // Pre-fill email from the JWT payload if possible
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]))
        if (payload.email) setEmail(payload.email)
      } catch { /* silent */ }
    }
  }, [])

  // ── Switch tabs — reset all transient state ─────────────────────────────────
  const switchTab = (t) => {
    setTab(t)
    setStep('form')
    setPassword('')
    setConfirmPw('')
    setShowPw(false)
    setShowConfirmPw(false)
    setResendCooldown(0)
    setLoginError('')
    setUnverifiedEmail('')
    // Keep loginBanner when switching so it still shows after "I've verified → Sign In"
  }

  // ── Login ────────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setLoginError('')
    setUnverifiedEmail('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // Clear any Supabase tokens from the URL after a successful login
      window.history.replaceState({}, '', window.location.pathname)
      // auth state change in useAuth() triggers App to swap in the main UI
    } catch (err) {
      const msg = err.message || ''
      if (
        msg.toLowerCase().includes('email not confirmed') ||
        msg.toLowerCase().includes('not confirmed')
      ) {
        setLoginError(
          'Please verify your email first. Check your inbox for the verification link.'
        )
        setUnverifiedEmail(email)
      } else {
        toast.error(msg || 'Sign in failed')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Signup ────────────────────────────────────────────────────────────────────
  //
  // IMPORTANT — Supabase Dashboard checklist (do this once per project):
  //   1. Authentication → Settings → "Enable email confirmations" must be ON
  //   2. Authentication → Settings → "Site URL" = your Netlify URL
  //      e.g. https://fridgeguard.netlify.app
  //   3. Authentication → Settings → "Redirect URLs" allowlist must include
  //      your Netlify URL (and http://localhost:5173 for local dev)
  //   4. Authentication → Email Templates → "Confirm signup" must not be empty
  //
  const handleSignup = async (e) => {
    e.preventDefault()
    if (password !== confirmPw) { toast.error("Passwords don't match"); return }
    if (password.length < 8)   { toast.error('Password must be at least 8 characters'); return }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })

      if (error) { console.error('Signup error:', error); throw error }

      // Supabase ghost-success: email already registered when confirmations are ON
      if (data.user?.identities?.length === 0) {
        throw new Error('An account with this email already exists. Try signing in instead.')
      }

      setSignedUpEmail(email)
      setResendCooldown(0)
      setStep('verifyEmail')
    } catch (err) {
      toast.error(err.message || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  // ── Forgot password ──────────────────────────────────────────────────────────
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

  // ── Resend verification email (used on both verifyEmail screen + login error) ─
  const handleResend = async (emailToResend) => {
    setResendLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailToResend,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) {
        console.error('Resend error:', error)
        toast.error(error.message)
      } else {
        setResendCooldown(60)   // start 60-second cooldown
      }
    } finally {
      setResendLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  STEP 2 — Verify email screen
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 'verifyEmail') {
    return (
      <AuthShell>
        <div className="flex flex-col items-center gap-5 py-2 text-center fade-in">

          {/* Icon */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
            style={{ background: 'rgba(124,174,122,0.12)' }}
          >
            ✉️
          </div>

          {/* Heading + explanation */}
          <div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>
              Verify your email
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              We sent a verification link to{' '}
              <strong style={{ color: 'var(--text)' }}>{signedUpEmail}</strong>.
              <br />
              Click the link in the email, then come back here to sign in.
            </p>
          </div>

          {/* Primary CTA — open email client */}
          <a
            href="https://mail.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary justify-center w-full"
            style={{ textDecoration: 'none' }}
          >
            <Mail size={15} /> Open Gmail
          </a>

          {/* Secondary — already clicked the link */}
          <button
            className="btn-ghost justify-center w-full"
            onClick={() => {
              setLoginBanner('verified')
              switchTab('login')
            }}
          >
            ✓ I've verified my email → Sign In
          </button>

          {/* Resend + spam note */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleResend(signedUpEmail)}
              disabled={resendLoading || resendCooldown > 0}
              className="text-xs"
              style={{
                color:           resendCooldown > 0 ? 'var(--muted)' : 'var(--sage)',
                textDecoration:  resendCooldown > 0 ? 'none' : 'underline',
                cursor:          resendCooldown > 0 ? 'default' : 'pointer',
              }}
            >
              {resendLoading
                ? <><Loader2 size={11} className="inline animate-spin mr-0.5" />Sending…</>
                : resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : 'Resend email'
              }
            </button>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Check your <strong>spam folder</strong> if you don't see it
            </p>
          </div>

        </div>
      </AuthShell>
    )
  }

  // ── Reset-sent confirmation screen ──────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────────
  //  Main card — Login / Signup tabs
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <AuthShell>
      {/* ── Tab bar ── */}
      <div className="flex rounded-xl p-1 mb-5" style={{ background: 'var(--border)' }}>
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

      {/* ── LOGIN form ── */}
      {tab === 'login' && step === 'form' && (
        <form key="login" onSubmit={handleLogin} className="flex flex-col gap-4 fade-in">

          {/* ✅ Email-verified success banner */}
          {loginBanner === 'verified' && (
            <div
              className="rounded-lg px-3 py-2.5 text-sm flex items-center gap-2"
              style={{ background: 'rgba(124,174,122,0.12)', color: '#15803D' }}
            >
              ✅ Email verified! You can now sign in.
            </div>
          )}

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

          {/* Unverified-email inline error + resend */}
          {loginError && (
            <div
              className="rounded-lg px-3 py-2.5 text-sm"
              style={{ background: '#FEF2F2', color: '#991B1B' }}
            >
              {loginError}
              {unverifiedEmail && (
                <button
                  type="button"
                  onClick={() => handleResend(unverifiedEmail)}
                  disabled={resendLoading || resendCooldown > 0}
                  className="block mt-1.5 text-xs font-semibold"
                  style={{
                    color:          resendCooldown > 0 ? '#9CA3AF' : 'var(--sage)',
                    textDecoration: 'underline',
                  }}
                >
                  {resendLoading
                    ? 'Sending…'
                    : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend verification email'
                  }
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary justify-center py-3 mt-1"
            disabled={loading}
          >
            {loading
              ? <Loader2 size={16} className="animate-spin" />
              : <><LogIn size={16} /> Sign In</>
            }
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

      {/* ── FORGOT PASSWORD form ── */}
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
            Enter your email and we'll send you a reset link.
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

      {/* ── SIGN UP form ── */}
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
          {/* Live match indicator */}
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
            disabled={loading || Boolean(confirmPw && password !== confirmPw)}
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

// ── Shell wrapper — logo + card ───────────────────────────────────────────────
// Defined at TOP LEVEL (not inside AuthPage) for a stable React component ref.
function AuthShell({ children }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm">
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
