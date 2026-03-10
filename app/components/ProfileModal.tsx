'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getProfileSettings, saveProfileSettings } from '@/lib/db'
import type { ProfileSettings } from '@/lib/types'

interface Props {
  userId: string
  userEmail: string
  onClose: () => void
  onSaved: () => void
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

export default function ProfileModal({ userId, userEmail, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ProfileSettings>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [passwordSection, setPasswordSection] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSaving, setPasswordSaving] = useState(false)

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

          {/* Profile fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

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
          </div>

          {/* Password section */}
          <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
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
          </div>

        </div>
      </div>
    </div>
  )
}
