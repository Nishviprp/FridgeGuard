import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Loader2, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        toast.success('Welcome back! 👋')
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        toast.success("Account created! Check your email to confirm. 📬")
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset`,
        })
        if (error) throw error
        setResetSent(true)
      }
    } catch (err) {
      toast.error(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-6xl block mb-3">🧊</span>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text)' }}>FridgeGuard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Beat food waste. Save money. Eat fresher.
          </p>
        </div>

        <div className="card p-6">
          {/* Tab switcher */}
          {mode !== 'reset' && (
            <div
              className="flex rounded-lg p-1 mb-6"
              style={{ background: 'var(--border)' }}
            >
              {['login', 'signup'].map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="flex-1 py-1.5 rounded-md text-sm font-semibold transition-all"
                  style={{
                    background: mode === m ? 'var(--surface)' : 'transparent',
                    color: mode === m ? 'var(--sage)' : 'var(--muted)',
                    boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  {m === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>
          )}

          {mode === 'reset' && resetSent ? (
            <div className="text-center py-4">
              <span className="text-4xl block mb-3">📬</span>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>Check your email</p>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                We sent a password reset link to <strong>{email}</strong>
              </p>
              <button
                className="mt-4 text-sm underline"
                style={{ color: 'var(--sage)' }}
                onClick={() => { setMode('login'); setResetSent(false) }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>

              {mode !== 'reset' && (
                <div>
                  <label className="form-label">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                      minLength={8}
                      required
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--muted)' }}
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="btn-primary justify-center py-2.5 mt-1"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : mode === 'login' ? (
                  <><LogIn size={16} /> Sign In</>
                ) : mode === 'signup' ? (
                  <><UserPlus size={16} /> Create Account</>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              {mode === 'login' && (
                <button
                  type="button"
                  className="text-xs text-center"
                  style={{ color: 'var(--muted)' }}
                  onClick={() => setMode('reset')}
                >
                  Forgot your password?
                </button>
              )}
              {mode === 'reset' && (
                <button
                  type="button"
                  className="text-xs text-center"
                  style={{ color: 'var(--muted)' }}
                  onClick={() => setMode('login')}
                >
                  ← Back to sign in
                </button>
              )}
            </form>
          )}
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--muted)' }}>
          Your fridge is private. Data is encrypted at rest.
        </p>
      </div>
    </div>
  )
}
