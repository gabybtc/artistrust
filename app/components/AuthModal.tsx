'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Mode = 'signin' | 'signup' | 'magic'

interface Props {
  onAuth: () => void
}

export default function AuthModal({ onAuth }: Props) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicSent, setMagicSent] = useState(false)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        setMagicSent(true)
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        })
        if (error) throw error
        // After signup, try to sign in immediately
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) {
          setError('Account created — check your email to confirm, then sign in.')
        } else {
          onAuth()
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onAuth()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(10,10,10,0.97)',
      backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 2,
        padding: '44px 40px 40px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26, fontWeight: 400, fontStyle: 'italic',
            letterSpacing: '0.01em', color: 'var(--text)',
            marginBottom: 6,
          }}>
            ArtisTrust
          </h1>
          <span style={{
            fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
            color: 'var(--accent-dim)', fontFamily: 'var(--font-body)',
          }}>
            Studio
          </span>
          <div style={{
            marginTop: 20,
            height: 1,
            background: 'linear-gradient(90deg, transparent, var(--accent-dim), transparent)',
            opacity: 0.4,
          }} />
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'flex', gap: 2, marginBottom: 28,
          background: 'var(--bg)', borderRadius: 2, padding: 3,
        }}>
          {(['signin', 'signup', 'magic'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setMagicSent(false) }}
              style={{
                flex: 1,
                background: mode === m ? 'var(--surface)' : 'transparent',
                border: mode === m ? '1px solid var(--border)' : '1px solid transparent',
                borderRadius: 1,
                padding: '7px 4px',
                color: mode === m ? 'var(--text)' : 'var(--text-dim)',
                fontFamily: 'var(--font-body)',
                fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {m === 'signin' ? 'Sign In' : m === 'signup' ? 'Create' : 'Magic Link'}
            </button>
          ))}
        </div>

        {/* Magic link sent */}
        {magicSent ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(201,169,110,0.12)',
              border: '1px solid var(--accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              color: 'var(--accent)', fontSize: 18,
            }}>
              ✓
            </div>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: 15, fontStyle: 'italic',
              color: 'var(--text)', marginBottom: 8,
            }}>
              Check your inbox
            </p>
            <p style={{
              fontSize: 13, color: 'var(--text-dim)',
              fontFamily: 'var(--font-body)', lineHeight: 1.6,
            }}>
              A magic link was sent to <strong style={{ color: 'var(--text)' }}>{email}</strong>.<br />
              Click it to sign in — no password needed.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {mode === 'signup' && (
              <div>
                <label style={labelStyle}>Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your full name"
                  required
                  autoFocus
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
            )}
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus={mode !== 'signup'}
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {mode !== 'magic' && (
              <div>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Choose a password' : ''}
                  required
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
            )}

            {error && (
              <p style={{
                fontSize: 13, color: '#e05555',
                fontFamily: 'var(--font-body)',
                background: 'rgba(224,85,85,0.08)',
                border: '1px solid rgba(224,85,85,0.2)',
                borderRadius: 2, padding: '9px 12px',
                lineHeight: 1.5,
              }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? 'transparent' : 'var(--accent)',
                border: `1px solid ${loading ? 'var(--accent-dim)' : 'var(--accent)'}`,
                borderRadius: 2,
                padding: '12px',
                color: loading ? 'var(--accent)' : '#0a0a0a',
                fontFamily: 'var(--font-body)',
                fontSize: 12, fontWeight: 600,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                cursor: loading ? 'default' : 'pointer',
                transition: 'all 0.18s',
                marginTop: 4,
              }}
            >
              {loading
                ? 'Please wait…'
                : mode === 'signin'
                ? 'Sign In'
                : mode === 'signup'
                ? 'Create Account'
                : 'Send Magic Link'}
            </button>
          </form>
        )}

        <p style={{
          textAlign: 'center', marginTop: 24,
          fontSize: 12, color: 'var(--muted)',
          fontFamily: 'var(--font-body)', lineHeight: 1.5,
        }}>
          Your catalogue is private and encrypted.
        </p>
      </div>
    </div>
  )
}
