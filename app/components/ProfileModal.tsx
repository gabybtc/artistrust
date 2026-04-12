'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getProfileSettings, saveProfileSettings } from '@/lib/db'
import type { ProfileSettings } from '@/lib/types'
import type { UserSubscription } from '@/lib/types'
import { planLabel, PLAN_CONFIG } from '@/lib/plans'

interface Props {
  userId: string
  userEmail: string
  onClose: () => void
  onSaved: () => void
  onSignOut: () => void
  subscription?: UserSubscription | null
  monthlyUploadsUsed?: number
  onOpenPricing?: () => void
}

const empty: ProfileSettings = {
  fullName: '',
  studioName: '',
  website: '',
  bio: '',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 2,
  padding: '9px 12px',
  color: 'var(--text)',
  fontSize: 14,
  fontFamily: 'var(--font-body)',
  fontWeight: 300,
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-body)',
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
  marginBottom: 6,
}

export default function ProfileModal({ userId, userEmail, onClose, onSaved, onSignOut, subscription, monthlyUploadsUsed, onOpenPricing }: Props) {
  const [form, setForm] = useState<ProfileSettings>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [section, setSection] = useState<'profile' | 'billing'>('profile')
  const [passwordSection, setPasswordSection] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [deleteSection, setDeleteSection] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    getProfileSettings(userId).then(data => {
      if (data) setForm(data)
      setLoading(false)
    })
  }, [userId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const set = (key: keyof ProfileSettings) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    await saveProfileSettings(userId, form)
    // Also update Supabase auth metadata with the full name
    if (form.fullName) {
      await supabase.auth.updateUser({ data: { full_name: form.fullName } })
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  const handlePasswordChange = async () => {
    setPasswordError(null)
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      return
    }
    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)
    if (error) {
      setPasswordError(error.message)
    } else {
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSection(false)
      onSaved()
    }
  }

  const initials = form.fullName
    ? form.fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : userEmail[0]?.toUpperCase() ?? '?'

  if (loading) return null

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', padding: '36px 20px',
        overflowY: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 2,
        width: '100%', maxWidth: 540,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        marginBottom: 36,
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.5 }}>
              <circle cx="7" cy="5" r="3" stroke="var(--accent)" strokeWidth="1.1"/>
              <path d="M1.5 13c0-2.485 2.462-4.5 5.5-4.5s5.5 2.015 5.5 4.5" stroke="var(--accent)" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}>
              Artist Profile
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: 18, lineHeight: 1,
              padding: '2px 4px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '28px 24px 32px' }}>

          {/* Avatar + email */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28,
            paddingBottom: 24, borderBottom: '1px solid var(--border)',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'rgba(201,169,110,0.12)',
              border: '1px solid var(--accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: 18, fontStyle: 'italic',
              color: 'var(--accent)', flexShrink: 0,
            }}>
              {initials}
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14, color: 'var(--text)',
                fontWeight: 400, marginBottom: 3,
              }}>
                {form.fullName || 'Artist'}
              </div>
              <div style={{
                fontSize: 12, color: 'var(--muted)',
                fontFamily: 'var(--font-body)',
              }}>
                {userEmail}
              </div>
            </div>
          </div>

          {/* Section tabs */}
          <div style={{
            display: 'flex', gap: 2, marginBottom: 28,
            background: 'var(--bg)', borderRadius: 2, padding: 3,
          }}>
            {(['profile', 'billing'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSection(s)}
                style={{
                  flex: 1,
                  background: section === s ? 'var(--surface)' : 'transparent',
                  border: section === s ? '1px solid var(--border)' : '1px solid transparent',
                  borderRadius: 1, padding: '7px 4px',
                  color: section === s ? 'var(--text)' : 'var(--text-dim)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {s === 'profile' ? 'Profile' : 'Billing'}
              </button>
            ))}
          </div>

          {section === 'billing' && <BillingSection
            subscription={subscription ?? null}
            monthlyUploadsUsed={monthlyUploadsUsed}
            onOpenPricing={onOpenPricing}
            onPortalError={() => {}}
          />}

          {/* Profile fields */}
          {section === 'profile' && <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={set('fullName')}
                placeholder="Your full name"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <div>
              <label style={labelStyle}>Studio / Organisation</label>
              <input
                type="text"
                value={form.studioName}
                onChange={set('studioName')}
                placeholder="Studio or gallery name"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <div>
              <label style={labelStyle}>Website</label>
              <input
                type="url"
                value={form.website}
                onChange={set('website')}
                placeholder="https://yoursite.com"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <div>
              <label style={labelStyle}>Bio</label>
              <textarea
                value={form.bio}
                onChange={set('bio')}
                placeholder="A short statement about your practice…"
                rows={3}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  lineHeight: 1.6,
                  minHeight: 80,
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: saving ? 'transparent' : 'var(--accent)',
                border: `1px solid ${saving ? 'var(--accent-dim)' : 'var(--accent)'}`,
                borderRadius: 2,
                padding: '11px',
                color: saving ? 'var(--accent)' : '#0a0a0a',
                fontFamily: 'var(--font-body)',
                fontSize: 12, fontWeight: 600,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                cursor: saving ? 'default' : 'pointer',
                transition: 'all 0.18s',
                marginTop: 4,
              }}
            >
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </div>}

          {/* Password section */}
          {section === 'profile' && <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => setPasswordSection(p => !p)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'var(--font-body)',
                fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'var(--text-dim)',
                padding: 0,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
            >
              <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
                <rect x="1" y="5" width="9" height="7" rx="1" stroke="currentColor" strokeWidth="1"/>
                <path d="M3.5 5V3.5a2 2 0 0 1 4 0V5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              </svg>
              Change Password
              <span style={{
                fontSize: 10, opacity: 0.5,
                transform: passwordSection ? 'rotate(180deg)' : 'none',
                display: 'inline-block', transition: 'transform 0.2s',
              }}>▾</span>
            </button>

            {passwordSection && (
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="New password (min 6 chars)"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>

                {passwordError && (
                  <p style={{
                    fontSize: 13, color: '#e05555',
                    fontFamily: 'var(--font-body)',
                    background: 'rgba(224,85,85,0.08)',
                    border: '1px solid rgba(224,85,85,0.2)',
                    borderRadius: 2, padding: '9px 12px',
                    lineHeight: 1.5,
                  }}>
                    {passwordError}
                  </p>
                )}

                <button
                  onClick={handlePasswordChange}
                  disabled={passwordSaving}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 2,
                    padding: '9px',
                    color: 'var(--text-dim)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 11, fontWeight: 500,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    cursor: passwordSaving ? 'default' : 'pointer',
                    transition: 'all 0.18s',
                  }}
                  onMouseEnter={e => {
                    if (!passwordSaving) {
                      e.currentTarget.style.borderColor = 'var(--muted)'
                      e.currentTarget.style.color = 'var(--text)'
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.color = 'var(--text-dim)'
                  }}
                >
                  {passwordSaving ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            )}
          </div>}

          {/* Danger zone */}
          {section === 'profile' && <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => { setDeleteSection(p => !p); setDeleteConfirm(''); setDeleteError(null) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'var(--font-body)',
                fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: '#e05555', padding: 0, transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
                <path d="M1 3h9M4 3V2h3v1M2 3l.5 8h6L9 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Delete Account
              <span style={{
                fontSize: 10, opacity: 0.5,
                transform: deleteSection ? 'rotate(180deg)' : 'none',
                display: 'inline-block', transition: 'transform 0.2s',
              }}>▾</span>
            </button>

            {deleteSection && (
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{
                  fontSize: 13, color: 'var(--text-dim)',
                  fontFamily: 'var(--font-body)', lineHeight: 1.6, margin: 0,
                  background: 'rgba(224,85,85,0.06)',
                  border: '1px solid rgba(224,85,85,0.15)',
                  borderRadius: 2, padding: '12px',
                }}>
                  This will <strong style={{ color: '#e05555' }}>permanently delete</strong> your account,
                  all artworks, and all stored files. This cannot be undone.
                </p>
                <div>
                  <label style={{ ...labelStyle, color: '#e05555' }}>
                    Type DELETE to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'rgba(224,85,85,0.5)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>

                {deleteError && (
                  <p style={{
                    fontSize: 13, color: '#e05555',
                    fontFamily: 'var(--font-body)',
                    background: 'rgba(224,85,85,0.08)',
                    border: '1px solid rgba(224,85,85,0.2)',
                    borderRadius: 2, padding: '9px 12px', lineHeight: 1.5,
                  }}>{deleteError}</p>
                )}

                <button
                  disabled={deleteConfirm !== 'DELETE' || deleteLoading}
                  onClick={async () => {
                    if (deleteConfirm !== 'DELETE') return
                    setDeleteLoading(true)
                    setDeleteError(null)
                    const { data } = await supabase.auth.getSession()
                    const token = data.session?.access_token
                    if (!token) { setDeleteError('Not signed in'); setDeleteLoading(false); return }
                    const res = await fetch('/api/account/delete', {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    const json = await res.json() as { ok?: boolean; error?: string }
                    if (!res.ok) {
                      setDeleteError(json.error ?? 'Deletion failed. Please try again.')
                      setDeleteLoading(false)
                      return
                    }
                    await supabase.auth.signOut()
                    onSignOut()
                    onClose()
                  }}
                  style={{
                    background: deleteConfirm === 'DELETE' && !deleteLoading
                      ? 'rgba(224,85,85,0.15)'
                      : 'transparent',
                    border: '1px solid rgba(224,85,85,0.3)',
                    borderRadius: 2, padding: '9px',
                    color: deleteConfirm === 'DELETE' ? '#e05555' : 'var(--muted)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 11, fontWeight: 500,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    cursor: deleteConfirm === 'DELETE' && !deleteLoading ? 'pointer' : 'not-allowed',
                    transition: 'all 0.18s',
                  }}
                >
                  {deleteLoading ? 'Deleting…' : 'Permanently Delete My Account'}
                </button>
              </div>
            )}
          </div>}

        </div>
      </div>
    </div>
  )
}

// ── Billing Section ──────────────────────────────────────────────────────

function BillingSection({
  subscription,
  monthlyUploadsUsed,
  onOpenPricing,
  onPortalError,
}: {
  subscription: UserSubscription | null
  monthlyUploadsUsed?: number
  onOpenPricing?: () => void
  onPortalError: () => void
}) {
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)

  const plan = subscription?.plan ?? 'preserve'
  const isBeta = subscription?.isBeta ?? false
  const isPaid = plan === 'studio' || plan === 'archive'
  const periodEnd = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null
  const daysLeft = periodEnd
    ? Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / 86_400_000))
    : null
  const planCfg = PLAN_CONFIG[plan]
  const uploadLimit = plan === 'beta' ? null : plan === 'preserve' ? 25 : plan === 'studio' ? 100 : 250

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-body)',
    fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
    color: 'var(--text-dim)', marginBottom: 6,
  }

  const handlePortal = async () => {
    setActionLoading(true)
    setBillingError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? 'Could not open billing portal')
      }
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Something went wrong')
      onPortalError()
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    setActionLoading(true)
    setBillingError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: 'subscription', plan: 'preserve', interval: 'monthly' }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? 'Cancellation failed')
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        window.location.href = '/?billing=success'
      }
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Plan badge */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'rgba(201,169,110,0.05)',
        border: '1px solid var(--border)',
        borderRadius: 2,
      }}>
        <div>
          <label style={labelStyle}>Current Plan</label>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 18,
            fontStyle: 'italic', color: 'var(--accent)',
          }}>
            {isBeta ? 'Beta' : planLabel(plan)}
          </div>
        </div>
        {isBeta && (
          <span style={{
            fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--accent)', border: '1px solid var(--accent-dim)',
            padding: '3px 8px', borderRadius: 2, fontFamily: 'var(--font-body)',
          }}>Beta Tester</span>
        )}
        {isPaid && subscription?.billingInterval && (
          <span style={{
            fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
          }}>{subscription.billingInterval}</span>
        )}
      </div>

      {/* Renewal / usage */}
      {(periodEnd || uploadLimit !== null) && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10,
          padding: '14px 16px',
          border: '1px solid var(--border)',
          borderRadius: 2,
        }}>
          {periodEnd && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
                {isPaid ? 'Renews' : 'Access until'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-body)' }}>
                {periodEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {daysLeft !== null && (
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>
                    {daysLeft === 0 ? 'today' : `${daysLeft}d left`}
                  </span>
                )}
              </span>
            </div>
          )}
          {uploadLimit !== null && monthlyUploadsUsed !== undefined && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>Uploads this month</span>
                <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--font-body)' }}>
                  {monthlyUploadsUsed} / {uploadLimit}
                </span>
              </div>
              <div style={{
                height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (monthlyUploadsUsed / uploadLimit) * 100)}%`,
                  background: monthlyUploadsUsed >= uploadLimit ? '#e05555' : 'var(--accent)',
                  borderRadius: 2, transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Key features summary */}
      {!isBeta && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {planCfg.features.filter(f => f.included).slice(0, 4).map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
            }}>
              <span style={{ color: 'var(--accent)', fontSize: 11, flexShrink: 0 }}>✓</span>
              {f.label}
            </div>
          ))}
        </div>
      )}

      {billingError && (
        <p style={{
          fontSize: 13, color: '#e05555', fontFamily: 'var(--font-body)',
          background: 'rgba(224,85,85,0.08)', border: '1px solid rgba(224,85,85,0.2)',
          borderRadius: 2, padding: '9px 12px', lineHeight: 1.5, margin: 0,
        }}>{billingError}</p>
      )}

      {/* Actions */}
      {!isBeta && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Upgrade / Change plan */}
          {onOpenPricing && (
            <button
              onClick={onOpenPricing}
              disabled={actionLoading}
              style={{
                background: isPaid ? 'transparent' : 'var(--accent)',
                border: `1px solid ${isPaid ? 'var(--border)' : 'var(--accent)'}`,
                borderRadius: 2, padding: '10px',
                color: isPaid ? 'var(--text-dim)' : '#0a0a0a',
                fontFamily: 'var(--font-body)',
                fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'all 0.18s',
              }}
              onMouseEnter={e => {
                if (isPaid) {
                  e.currentTarget.style.borderColor = 'var(--muted)'
                  e.currentTarget.style.color = 'var(--text)'
                }
              }}
              onMouseLeave={e => {
                if (isPaid) {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-dim)'
                }
              }}
            >
              {isPaid ? 'Change Plan' : 'Upgrade Plan'}
            </button>
          )}

          {/* Stripe portal */}
          {isPaid && (
            <button
              onClick={handlePortal}
              disabled={actionLoading}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 2, padding: '10px',
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-body)',
                fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase',
                cursor: actionLoading ? 'default' : 'pointer', transition: 'all 0.18s',
              }}
              onMouseEnter={e => {
                if (!actionLoading) {
                  e.currentTarget.style.borderColor = 'var(--muted)'
                  e.currentTarget.style.color = 'var(--text)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-dim)'
              }}
            >
              {actionLoading ? 'Opening…' : 'Manage Billing & Invoices'}
            </button>
          )}

          {/* Cancel (downgrade to Preserve) */}
          {isPaid && !cancelConfirm && (
            <button
              onClick={() => setCancelConfirm(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', fontFamily: 'var(--font-body)',
                fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '8px 0', textAlign: 'left', transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#e05555')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >
              Cancel Subscription
            </button>
          )}

          {isPaid && cancelConfirm && (
            <div style={{
              padding: '14px', borderRadius: 2,
              background: 'rgba(224,85,85,0.06)',
              border: '1px solid rgba(224,85,85,0.2)',
            }}>
              <p style={{
                fontSize: 13, color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
                lineHeight: 1.6, margin: '0 0 12px',
              }}>
                Your subscription will remain active until the end of the current period.
                You&apos;ll keep access until{' '}
                {periodEnd ? periodEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'period end'},
                then revert to the free Preserve plan.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setCancelConfirm(false)}
                  style={{
                    flex: 1, background: 'transparent',
                    border: '1px solid var(--border)', borderRadius: 2, padding: '8px',
                    color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
                    fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >Keep Plan</button>
                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  style={{
                    flex: 1,
                    background: actionLoading ? 'transparent' : 'rgba(224,85,85,0.15)',
                    border: '1px solid rgba(224,85,85,0.4)', borderRadius: 2, padding: '8px',
                    color: '#e05555', fontFamily: 'var(--font-body)',
                    fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: actionLoading ? 'default' : 'pointer',
                  }}
                >
                  {actionLoading ? 'Cancelling…' : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  )
}
