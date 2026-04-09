'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user lands here via the reset link.
    // The JS client reads the #access_token from the URL hash and establishes a session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    // Also handle the case where the session is already established (page reload)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => { window.location.href = '/?passwordReset=success' }, 1500)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 2,
    color: 'var(--text)',
    fontSize: 15,
    fontFamily: 'var(--font-body)',
    fontWeight: 300,
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-body)',
    marginBottom: 7,
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 2,
        padding: '44px 40px 40px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26, fontWeight: 400, fontStyle: 'italic',
            letterSpacing: '0.01em', color: 'var(--text)',
            marginBottom: 6,
          }}>
            ArtisTrust
          </h1>
          <div style={{
            marginTop: 20, height: 1,
            background: 'linear-gradient(90deg, transparent, var(--accent-dim), transparent)',
            opacity: 0.4,
          }} />
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(201,169,110,0.12)',
              border: '1px solid var(--accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              color: 'var(--accent)', fontSize: 18,
            }}>✓</div>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: 15, fontStyle: 'italic',
              color: 'var(--text)', marginBottom: 8,
            }}>Password updated</p>
            <p style={{
              fontSize: 13, color: 'var(--text-dim)',
              fontFamily: 'var(--font-body)', lineHeight: 1.6,
            }}>Signing you in…</p>
          </div>
        ) : !ready ? (
          <p style={{
            textAlign: 'center', fontSize: 13,
            color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
            lineHeight: 1.6,
          }}>
            Verifying your reset link…
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p style={{
              fontSize: 13, color: 'var(--text-dim)',
              fontFamily: 'var(--font-body)', lineHeight: 1.6, margin: 0,
            }}>
              Choose a new password for your account.
            </p>
            <div>
              <label style={labelStyle}>New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                autoFocus
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                required
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            {error && (
              <p style={{
                fontSize: 13, color: '#e05555',
                fontFamily: 'var(--font-body)',
                background: 'rgba(224,85,85,0.08)',
                border: '1px solid rgba(224,85,85,0.2)',
                borderRadius: 2, padding: '9px 12px', lineHeight: 1.5,
              }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? 'transparent' : 'var(--accent)',
                border: `1px solid ${loading ? 'var(--accent-dim)' : 'var(--accent)'}`,
                borderRadius: 2, padding: '12px',
                color: loading ? 'var(--accent)' : '#0a0a0a',
                fontFamily: 'var(--font-body)',
                fontSize: 12, fontWeight: 600,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                cursor: loading ? 'default' : 'pointer',
                transition: 'all 0.18s', marginTop: 4,
              }}
            >{loading ? 'Updating…' : 'Set New Password'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
