'use client'
import { useState, useEffect } from 'react'
import { getLegalSettings, saveLegalSettings } from '@/lib/db'
import type { LegalSettings } from '@/lib/types'

interface Props {
  userId: string
  onClose: () => void
  onSaved: () => void
}

const empty: LegalSettings = {
  designeeName: '',
  designeeEmail: '',
  designeeRelationship: '',
  designeePhone: '',
  attorneyName: '',
  attorneyContact: '',
  notes: '',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 2,
  padding: '9px 12px',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font-body)',
  fontWeight: 300,
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-body)',
  fontSize: 10,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
  marginBottom: 6,
}

export default function LegalModal({ userId, onClose, onSaved }: Props) {
  const [form, setForm] = useState<LegalSettings>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getLegalSettings(userId).then(data => {
      if (data) setForm(data)
      setLoading(false)
    })
  }, [userId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const set = (key: keyof LegalSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    await saveLegalSettings(userId, form)
    setSaving(false)
    onSaved()
    onClose()
  }

  const field = (label: string, key: keyof LegalSettings, placeholder: string) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="text"
        value={form[key]}
        onChange={set(key)}
        placeholder={placeholder}
        style={inputStyle}
        onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border)')}
      />
    </div>
  )

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
        width: '100%', maxWidth: 600,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="14" height="14" viewBox="0 0 10 11" fill="none" style={{ opacity: 0.5 }}>
              <rect x="1" y="1" width="8" height="9" rx="1" stroke="var(--accent)" strokeWidth="1"/>
              <path d="M3 4h4M3 6.5h4M3 9h2.5" stroke="var(--accent)" strokeWidth="0.9" strokeLinecap="round"/>
            </svg>
            <span style={{
              fontFamily: 'var(--font-body)', fontSize: 10,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}>
              Legal &amp; Estate{' '}<span style={{ color: 'var(--text)' }}>/ Catalogue Access</span>
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid var(--border)',
              cursor: 'pointer', width: 28, height: 28, borderRadius: 2,
              color: 'var(--text-dim)', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-dim)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
          >
            ×
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 13 }}>
            Loading…
          </div>
        ) : (
          <div style={{ padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Intro callout */}
            <div style={{
              background: 'rgba(201,169,110,0.06)',
              border: '1px solid rgba(201,169,110,0.2)',
              borderRadius: 2,
              padding: '14px 16px',
            }}>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: 14, fontStyle: 'italic', fontWeight: 400,
                color: 'var(--text)', lineHeight: 1.6, margin: 0,
              }}>
                In the event of your death or incapacitation, who should have access to this catalogue?
              </p>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6,
                marginTop: 8, letterSpacing: '0.03em',
              }}>
                This information is stored privately in your account. It can be included in your will or
                trust documents as a reference. We recommend printing this page and giving a copy to your
                designated person and attorney.
              </p>
            </div>

            {/* Section: Designated person */}
            <div>
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: 9,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'var(--accent-dim)', marginBottom: 14,
              }}>
                Designated Person
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {field('Full Name', 'designeeName', 'e.g. Sarah Betancourt')}
                  {field('Relationship', 'designeeRelationship', 'e.g. Spouse, Child, Executor')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {field('Email', 'designeeEmail', 'their@email.com')}
                  {field('Phone', 'designeePhone', 'e.g. +1 555 000 0000')}
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />

            {/* Section: Attorney */}
            <div>
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: 9,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'var(--accent-dim)', marginBottom: 14,
              }}>
                Attorney / Legal Representative <span style={{ color: 'var(--muted)', textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>(optional)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {field('Attorney Name', 'attorneyName', 'e.g. James Harlow, Esq.')}
                {field('Contact / Firm', 'attorneyContact', 'e.g. firm name or phone')}
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />

            {/* Notes */}
            <div>
              <label style={labelStyle}>Additional Instructions</label>
              <textarea
                value={form.notes}
                onChange={set('notes')}
                rows={4}
                placeholder="e.g. Works valued over $10,000 should be appraised before sale. Contact the gallery first. See my will, section 4B for further instructions."
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  lineHeight: 1.6,
                  minHeight: 90,
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* Legal language note */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 2, padding: '12px 14px',
            }}>
              <p style={{
                fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
                lineHeight: 1.65, margin: 0,
              }}>
                <strong style={{ color: 'var(--text)', fontWeight: 500 }}>Suggested will language: </strong>
                &ldquo;I grant{' '}
                <em>{form.designeeName || '[Designated Person]'}</em>
                {form.designeeRelationship ? ` (${form.designeeRelationship})` : ''} full access to my digital
                art catalogue maintained at artistrust.com, including the right to manage, sell, donate, or
                otherwise dispose of the works listed therein in accordance with the terms of this will.&rdquo;
              </p>
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: saving ? 'transparent' : 'var(--accent)',
                border: `1px solid ${saving ? 'var(--accent-dim)' : 'var(--accent)'}`,
                borderRadius: 2, padding: 12, width: '100%',
                color: saving ? 'var(--accent)' : '#0a0a0a',
                fontFamily: 'var(--font-body)',
                fontSize: 11, fontWeight: 500,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                cursor: saving ? 'default' : 'pointer',
                transition: 'all 0.18s',
              }}
            >
              {saving ? 'Saving…' : 'Save Legal Settings'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
