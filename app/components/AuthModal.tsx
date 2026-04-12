'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PLAN_CONFIG } from '@/lib/plans'
import type { Plan, BillingInterval } from '@/lib/plans'

type Mode = 'signin' | 'signup' | 'magic' | 'forgot' | 'plan'

interface Props {
  onAuth: () => void
  standalone?: boolean
  defaultView?: 'signin' | 'signup' | 'magic'
  planIntent?: Plan
  intervalIntent?: BillingInterval
}

export default function AuthModal({ onAuth, standalone, defaultView, planIntent, intervalIntent }: Props) {
  const [mode, setMode] = useState<Mode>(defaultView ?? 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicSent, setMagicSent] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [planInterval, setPlanInterval] = useState<BillingInterval>(intervalIntent ?? 'monthly')
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const triggerCheckout = async (plan: Plan, interval: BillingInterval) => {
    setCheckoutLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: 'subscription', plan, interval }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Checkout failed')
      }
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setCheckoutLoading(false)
    }
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
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        })
        if (error) throw error
        setResetSent(true)
      } else if (mode === 'signup') {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        })
        if (error) throw error
        // Fire welcome email right after signup — works whether or not email
        // confirmation is required (session may not exist yet).
        if (signUpData.user?.id) {
          fetch('/api/email/welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: signUpData.user.id,
              email: signUpData.user.email,
              name,
            }),
          }).catch(() => { /* non-critical */ })
        }
        // After signup, try to sign in immediately
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) {
          setError('Account created — check your email to confirm, then sign in.')
        } else if (planIntent) {
          if (intervalIntent) {
            await triggerCheckout(planIntent, intervalIntent)
          } else {
            setMode('plan')
          }
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

  const planConfig = planIntent ? PLAN_CONFIG[planIntent] : null

  const card = (
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
              onClick={() => { setMode(m); setError(null); setMagicSent(false); setResetSent(false) }}
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

        {/* Forgot password / reset sent */}
        {mode === 'forgot' ? (
          resetSent ? (
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
              }}>Check your inbox</p>
              <p style={{
                fontSize: 13, color: 'var(--text-dim)',
                fontFamily: 'var(--font-body)', lineHeight: 1.6,
              }}>
                A reset link was sent to <strong style={{ color: 'var(--text)' }}>{email}</strong>.<br />
                Click it to set a new password.
              </p>
              <button
                onClick={() => { setMode('signin'); setResetSent(false) }}
                style={{
                  marginTop: 20, background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--accent)',
                  fontFamily: 'var(--font-body)', fontSize: 12,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}
              >Back to sign in</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <p style={{
                fontSize: 13, color: 'var(--text-dim)',
                fontFamily: 'var(--font-body)', lineHeight: 1.6,
                margin: 0,
              }}>
                Enter your email and we&apos;ll send a link to reset your password.
              </p>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoFocus
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
              >{loading ? 'Sending…' : 'Send Reset Link'}</button>
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null) }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
                  fontSize: 12, letterSpacing: '0.06em',
                }}
              >← Back to sign in</button>
            </form>
          )
        ) : magicSent ? (
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
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Choose a password' : ''}
                    required
                    style={{ ...inputStyle, paddingRight: 42 }}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    style={{
                      position: 'absolute', right: 12, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 0, color: showPassword ? 'var(--accent-dim)' : 'var(--muted)',
                      display: 'flex', alignItems: 'center',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                    onMouseLeave={e => (e.currentTarget.style.color = showPassword ? 'var(--accent-dim)' : 'var(--muted)')}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      // Eye-off icon
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      // Eye icon
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
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

            {mode === 'signin' && (
              <div style={{ textAlign: 'right', marginTop: -10 }}>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--muted)', fontFamily: 'var(--font-body)',
                    fontSize: 12, letterSpacing: '0.04em',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                >Forgot password?</button>
              </div>
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
        ) }

        <div style={{
          marginTop: 24,
          borderTop: '1px solid var(--border)',
          paddingTop: 16,
        }}>
          <p style={{
            textAlign: 'center',
            fontSize: 11, color: 'var(--muted)',
            fontFamily: 'var(--font-body)', lineHeight: 1.9,
            letterSpacing: '0.02em',
          }}>
            Your images are stored on{' '}
            <span style={{ color: 'var(--text-dim)' }}>AWS S3 (US)</span>,
            encrypted at rest and in transit.<br />
            We claim{' '}
            <span style={{ color: 'var(--text-dim)' }}>no rights</span>{' '}
            to your work — your IP is yours, always.
          </p>
          <p style={{
            textAlign: 'center', marginTop: 10,
            fontSize: 11, color: 'var(--muted)',
            fontFamily: 'var(--font-body)',
          }}>
            <a href="/privacy" style={{ color: 'var(--muted)', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-dim)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >Privacy Policy</a>
            {' · '}
            <a href="/terms" style={{ color: 'var(--muted)', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-dim)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >Terms of Service</a>
          </p>
        </div>
      </div>
  )

  // ── Plan / interval picker view ────────────────────────────────────────────
  if (mode === 'plan' && planConfig && planIntent) {
    const monthlyPrice = planConfig.monthlyPrice
    const annualTotal = (planConfig as { annualTotal?: number }).annualTotal ?? 0
    const annualMonthlyPrice = (planConfig as { annualMonthlyPrice?: number }).annualMonthlyPrice ?? 0

    const planCard = (
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 2,
        padding: '44px 40px 40px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26, fontWeight: 400, fontStyle: 'italic',
            letterSpacing: '0.01em', color: 'var(--text)', marginBottom: 6,
          }}>ArtisTrust</h1>
          <div style={{
            marginTop: 20, height: 1,
            background: 'linear-gradient(90deg, transparent, var(--accent-dim), transparent)',
            opacity: 0.4,
          }} />
        </div>

        <p style={{
          textAlign: 'center', marginBottom: 6,
          fontFamily: 'var(--font-body)',
          fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'var(--text-dim)',
        }}>Account created — choose your plan</p>
        <p style={{
          textAlign: 'center', marginBottom: 24,
          fontFamily: 'var(--font-display)',
          fontSize: 20, fontStyle: 'italic',
          color: 'var(--accent)',
        }}>{planConfig.label}</p>

        {/* Monthly / Annual toggle */}
        <div style={{
          display: 'flex', gap: 2, marginBottom: 24,
          background: 'var(--bg)', borderRadius: 2, padding: 3,
        }}>
          {(['monthly', 'annual'] as BillingInterval[]).map(iv => (
            <button
              key={iv}
              onClick={() => setPlanInterval(iv)}
              style={{
                flex: 1, position: 'relative',
                background: planInterval === iv ? 'var(--surface)' : 'transparent',
                border: planInterval === iv ? '1px solid var(--border)' : '1px solid transparent',
                borderRadius: 1, padding: '7px 4px',
                color: planInterval === iv ? 'var(--text)' : 'var(--text-dim)',
                fontFamily: 'var(--font-body)',
                fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {iv === 'monthly' ? 'Monthly' : 'Annual'}
              {iv === 'annual' && (
                <span style={{
                  marginLeft: 6, fontSize: 9, letterSpacing: '0.08em',
                  color: 'var(--accent)', opacity: 0.9,
                }}>−20%</span>
              )}
            </button>
          ))}
        </div>

        {/* Price display */}
        <div style={{
          textAlign: 'center', marginBottom: 20,
          padding: '16px',
          background: 'rgba(201,169,110,0.05)',
          border: '1px solid var(--border)',
          borderRadius: 2,
        }}>
          {planInterval === 'monthly' ? (
            <>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 32,
                fontStyle: 'italic', color: 'var(--text)',
              }}>${monthlyPrice}</span>
              <span style={{
                fontFamily: 'var(--font-body)', fontSize: 13,
                color: 'var(--text-dim)', marginLeft: 4,
              }}>/month</span>
            </>
          ) : (
            <>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: 32,
                fontStyle: 'italic', color: 'var(--text)',
              }}>${annualMonthlyPrice}</span>
              <span style={{
                fontFamily: 'var(--font-body)', fontSize: 13,
                color: 'var(--text-dim)', marginLeft: 4,
              }}>/month</span>
              <div style={{
                fontSize: 11, color: 'var(--muted)',
                fontFamily: 'var(--font-body)', marginTop: 4,
              }}>
                Billed as ${annualTotal}/year
              </div>
            </>
          )}
        </div>

        {/* Key features */}
        <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {planConfig.features.filter(f => f.included).map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, color: 'var(--text-dim)',
              fontFamily: 'var(--font-body)',
            }}>
              <span style={{ color: 'var(--accent)', fontSize: 12, flexShrink: 0 }}>✓</span>
              {f.label}
            </div>
          ))}
        </div>

        {error && (
          <p style={{
            fontSize: 13, color: '#e05555',
            fontFamily: 'var(--font-body)',
            background: 'rgba(224,85,85,0.08)',
            border: '1px solid rgba(224,85,85,0.2)',
            borderRadius: 2, padding: '9px 12px', lineHeight: 1.5, marginBottom: 14,
          }}>{error}</p>
        )}

        <button
          onClick={() => triggerCheckout(planIntent!, planInterval)}
          disabled={checkoutLoading}
          style={{
            width: '100%',
            background: checkoutLoading ? 'transparent' : 'var(--accent)',
            border: `1px solid ${checkoutLoading ? 'var(--accent-dim)' : 'var(--accent)'}`,
            borderRadius: 2, padding: '12px',
            color: checkoutLoading ? 'var(--accent)' : '#0a0a0a',
            fontFamily: 'var(--font-body)',
            fontSize: 12, fontWeight: 600,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            cursor: checkoutLoading ? 'default' : 'pointer',
            transition: 'all 0.18s',
          }}
        >
          {checkoutLoading ? 'Redirecting…' : 'Continue to Payment'}
        </button>

        <button
          type="button"
          onClick={onAuth}
          style={{
            display: 'block', width: '100%', marginTop: 12,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', fontFamily: 'var(--font-body)',
            fontSize: 12, letterSpacing: '0.04em', textAlign: 'center',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-dim)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
        >
          Skip for now — go to my archive
        </button>
      </div>
    )

    if (standalone) return planCard
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(10,10,10,0.97)',
        backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}>
        {planCard}
      </div>
    )
  }

  if (standalone) return card
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(10,10,10,0.97)',
      backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      {card}
    </div>
  )
}
