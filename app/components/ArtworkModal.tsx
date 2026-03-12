"use client"
import { useState, useEffect } from 'react'
import { Artwork, Tab } from '@/lib/types'
import VoiceRecorder from './VoiceRecorder'

interface ArtworkModalProps {
  artwork: Artwork
  tabs: Tab[]
  onClose: () => void
  onUpdate: (updated: Partial<Artwork>) => void
  onDelete?: () => void
  onSaved?: () => void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 2,
  padding: '8px 12px',
  color: 'var(--text)',
  fontSize: 14,
  fontFamily: 'var(--font-body)',
  fontWeight: 300,
  outline: 'none',
  transition: 'border-color 0.2s',
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

export default function ArtworkModal({ artwork, tabs, onClose, onUpdate, onDelete, onSaved }: ArtworkModalProps) {
  const displayTitle = artwork.title || artwork.aiAnalysis?.suggestedTitle || 'Untitled'
  const medium = artwork.material || artwork.aiAnalysis?.medium

  const [form, setForm] = useState({
    title:              artwork.title    || artwork.aiAnalysis?.suggestedTitle || '',
    year:               artwork.year     || '',
    place:              artwork.place    || '',
    location:           artwork.location || '',
    width:              artwork.width    || '',
    height:             artwork.height   || '',
    unit:               (artwork.unit    || 'cm') as 'cm' | 'in',
    material:           artwork.material || artwork.aiAnalysis?.medium || '',
    mediaType:          artwork.mediaType || (tabs[0]?.id ?? 'painting'),
    copyrightStatus:    artwork.copyrightStatus    || 'automatic' as 'automatic' | 'registered',
    copyrightHolder:    artwork.copyrightHolder    || '',
    copyrightYear:      artwork.copyrightYear      || artwork.year || new Date().getFullYear().toString(),
    copyrightRegNumber: artwork.copyrightRegNumber || '',
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = () => {
    onUpdate({ ...form, status: 'complete' })
    onSaved?.()
    onClose()
  }

  const field = (label: string, key: keyof typeof form, placeholder?: string) => (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="text"
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
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
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', padding: '36px 20px',
        overflowY: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 2,
          width: '100%', maxWidth: 940,
          overflow: 'hidden',
          transform: 'translateY(0)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* ── Modal header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Breadcrumb */}
            <span style={{
              fontFamily: 'var(--font-body)', fontSize: 11,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}>
              {(tabs.find(t => t.id === form.mediaType)?.label ?? form.mediaType)}{' '}
              <span style={{ color: 'var(--text)' }}>/ {displayTitle}</span>
            </span>
            {medium && (
              <span className="tag tag-gold">{medium}</span>
            )}
          </div>

          {/* Close button with border */}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              width: 28, height: 28,
              borderRadius: 2,
              color: 'var(--text-dim)',
              fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--text-dim)'
              e.currentTarget.style.color = 'var(--text)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color = 'var(--text-dim)'
            }}
          >
            ×
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

          {/* Left — Image */}
          <div style={{
            borderRight: '1px solid var(--border)',
            position: 'relative',
            background: 'var(--surface)',
            minHeight: 480,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={artwork.imageData}
              alt={displayTitle}
              style={{
                width: '100%', height: '100%', maxHeight: 560,
                objectFit: 'contain', display: 'block',
              }}
            />

            {/* Color palette — top right */}
            {artwork.aiAnalysis?.colorPalette && (
              <div style={{
                position: 'absolute', top: 12, right: 12,
                display: 'flex', gap: 4,
              }}>
                {artwork.aiAnalysis.colorPalette.map((c, i) => (
                  <div key={i} style={{
                    width: 13, height: 13, borderRadius: '50%',
                    background: c,
                    border: '1px solid rgba(255,255,255,0.15)',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                  }} />
                ))}
              </div>
            )}

            {/* Caption overlay — bottom */}
            {artwork.aiAnalysis?.description && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '36px 20px 18px',
                background: 'linear-gradient(to top, rgba(10,10,10,0.96) 0%, transparent 100%)',
              }}>
                <p style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 15, fontStyle: 'italic',
                  color: 'rgba(232,232,232,0.8)', lineHeight: 1.65,
                }}>
                  &ldquo;{artwork.aiAnalysis.description}&rdquo;
                </p>
              </div>
            )}
          </div>

          {/* Right — Form */}
          <div style={{
            padding: '26px 26px 22px',
            display: 'flex', flexDirection: 'column', gap: 16,
            overflowY: 'auto', maxHeight: 580,
          }}>

            {/* Title (display style) */}
            <div>
              <label style={labelStyle}>Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder={artwork.aiAnalysis?.suggestedTitle || 'Untitled'}
                style={{
                  ...inputStyle,
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontSize: 20,
                  fontWeight: 400,
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <hr className="gold-rule" />

            {/* Year & Place */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {field('Year', 'year', 'e.g. 2023')}
              {field('Place', 'place', 'e.g. Paris')}
            </div>

            {/* Category toggle */}
            <div>
              <label style={labelStyle}>Category</label>
              <div style={{ display: 'flex', gap: 3 }}>
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, mediaType: tab.id }))}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      background: form.mediaType === tab.id ? 'rgba(201,169,110,0.12)' : 'transparent',
                      border: `1px solid ${form.mediaType === tab.id ? 'var(--accent-dim)' : 'var(--border)'}`,
                      borderRadius: 2,
                      color: form.mediaType === tab.id ? 'var(--accent)' : 'var(--text-dim)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 11, letterSpacing: '0.12em', textTransform: 'capitalize',
                      cursor: 'pointer',
                      transition: 'all 0.18s',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>
                Material
                {!artwork.material && artwork.aiAnalysis?.medium && (
                  <span style={{
                    marginLeft: 6,
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--accent-dim)',
                    fontWeight: 400,
                  }}>· suggested by Claude</span>
                )}
              </label>
              <input
                type="text"
                value={form.material}
                onChange={e => setForm(f => ({ ...f, material: e.target.value }))}
                placeholder={form.mediaType === 'photography' ? 'e.g. 35mm Film, Silver gelatin' : 'e.g. Oil on linen, Acrylic'}
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* Location */}
            <div>
              <label style={labelStyle}>Current Location</label>
              <input
                type="text"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Studio storage, Home — living room, Bank vault"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
              <p style={{
                marginTop: 5, fontSize: 11, color: 'var(--muted)',
                fontFamily: 'var(--font-body)', letterSpacing: '0.04em',
              }}>
                Used for provenance records, insurance &amp; estate documentation
              </p>
            </div>
            <div>
              <label style={labelStyle}>Dimensions</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="text" value={form.width}
                  onChange={e => setForm(f => ({ ...f, width: e.target.value }))}
                  placeholder="W"
                  style={{ ...inputStyle, flex: 1, textAlign: 'center' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
                <span style={{ color: 'var(--muted)', fontSize: 13, flexShrink: 0 }}>×</span>
                <input
                  type="text" value={form.height}
                  onChange={e => setForm(f => ({ ...f, height: e.target.value }))}
                  placeholder="H"
                  style={{ ...inputStyle, flex: 1, textAlign: 'center' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
                <select
                  value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value as 'cm' | 'in' }))}
                  style={{
                    ...inputStyle, width: 60, flexShrink: 0,
                    cursor: 'pointer',
                  }}
                >
                  <option value="cm">cm</option>
                  <option value="in">in</option>
                </select>
              </div>
            </div>

            <hr className="gold-rule" />

            {/* Copyright */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: 10,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'var(--accent-dim)',
              }}>
                Copyright Protection
              </div>

              {/* Status dropdown */}
              <div>
                <label style={labelStyle}>Protection Level</label>
                <select
                  value={form.copyrightStatus}
                  onChange={e => setForm(f => ({ ...f, copyrightStatus: e.target.value as 'automatic' | 'registered' }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                >
                  <option value="automatic">Automatic — Berne Convention (default)</option>
                  <option value="registered">Registered — Copyright Office</option>
                </select>
                <p style={{
                  marginTop: 5, fontSize: 11, color: 'var(--muted)',
                  fontFamily: 'var(--font-body)', letterSpacing: '0.03em', lineHeight: 1.5,
                }}>
                  {form.copyrightStatus === 'automatic'
                    ? 'Copyright exists automatically from the moment of creation in 181 countries under the Berne Convention. No registration required.'
                    : 'Formal registration with the US Copyright Office (or equivalent) provides stronger legal standing and enables statutory damages in infringement cases.'}
                </p>
              </div>

              {/* Holder + Year — always shown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Copyright Holder</label>
                  <input
                    type="text"
                    value={form.copyrightHolder}
                    onChange={e => setForm(f => ({ ...f, copyrightHolder: e.target.value }))}
                    placeholder="Your full legal name"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Copyright Year</label>
                  <input
                    type="text"
                    value={form.copyrightYear}
                    onChange={e => setForm(f => ({ ...f, copyrightYear: e.target.value }))}
                    placeholder={new Date().getFullYear().toString()}
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>
              </div>

              {/* Registration number — only if registered */}
              {form.copyrightStatus === 'registered' && (
                <div>
                  <label style={labelStyle}>Registration Number</label>
                  <input
                    type="text"
                    value={form.copyrightRegNumber}
                    onChange={e => setForm(f => ({ ...f, copyrightRegNumber: e.target.value }))}
                    placeholder="e.g. VA 1-234-567"
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                  <p style={{
                    marginTop: 5, fontSize: 11, color: 'var(--muted)',
                    fontFamily: 'var(--font-body)', letterSpacing: '0.03em',
                  }}>
                    Register at <span style={{ color: 'var(--accent-dim)' }}>copyright.gov</span> (US) or your country&apos;s equivalent.
                  </p>
                </div>
              )}

              {/* Copyright notice preview */}
              <div style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 2, padding: '9px 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <span style={{
                  fontFamily: 'var(--font-body)', fontSize: 12,
                  color: 'var(--text-dim)', letterSpacing: '0.03em',
                }}>
                  © {form.copyrightYear || new Date().getFullYear()} {form.copyrightHolder || '—'}
                  {form.copyrightStatus === 'registered' && form.copyrightRegNumber
                    ? ` · Reg. ${form.copyrightRegNumber}` : ''}
                </span>
                <span style={{
                  fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: form.copyrightStatus === 'registered' ? 'var(--accent)' : 'var(--text-dim)',
                  fontFamily: 'var(--font-body)',
                  background: form.copyrightStatus === 'registered' ? 'rgba(201,169,110,0.1)' : 'transparent',
                  border: `1px solid ${form.copyrightStatus === 'registered' ? 'rgba(201,169,110,0.3)' : 'var(--border)'}`,
                  borderRadius: 2, padding: '2px 7px',
                }}>
                  {form.copyrightStatus === 'registered' ? 'Registered' : 'Automatic'}
                </span>
              </div>
            </div>

            <hr className="gold-rule" />
            {artwork.aiAnalysis && (
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 2, padding: '12px 14px',
              }}>
                <div style={{
                  fontFamily: 'var(--font-body)', fontSize: 10,
                  letterSpacing: '0.15em', textTransform: 'uppercase',
                  color: 'var(--accent-dim)', marginBottom: 9,
                }}>
                  Claude&rsquo;s Analysis
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {artwork.aiAnalysis.style   && <span className="tag">{artwork.aiAnalysis.style}</span>}
                  {artwork.aiAnalysis.subject && <span className="tag">{artwork.aiAnalysis.subject}</span>}
                </div>
              </div>
            )}

            {/* Voice Recorder */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 2, padding: '14px 16px',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 14,
                fontStyle: 'italic', color: 'var(--text-dim)', marginBottom: 12,
              }}>
                Artist&rsquo;s Story
              </div>
              <VoiceRecorder
                existingAudio={artwork.voiceMemo}
                onSave={(audioData) => onUpdate({ voiceMemo: audioData })}
              />
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              style={{
                marginTop: 4,
                background: 'var(--accent)',
                border: 'none', borderRadius: 2,
                padding: 12, width: '100%',
                color: '#0a0a0a',
                fontFamily: 'var(--font-body)',
                fontSize: 12, fontWeight: 500,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Save to Catalogue
            </button>

            {onDelete && (
              <button
                onClick={onDelete}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)', borderRadius: 2,
                  padding: '8px', width: '100%',
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--font-body)',
                fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#e05555'
                  e.currentTarget.style.color = '#e05555'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-dim)'
                }}
              >
                Remove from Archive
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
