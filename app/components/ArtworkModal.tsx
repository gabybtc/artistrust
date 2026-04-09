"use client"
import { useState, useEffect } from 'react'
import { Artwork, Tab, UploadDefaults } from '@/lib/types'
import VoiceRecorder from './VoiceRecorder'
import ArtworkLightbox from './ArtworkLightbox'
import SmartInput from './SmartInput'
import TagEditor from './TagEditor'

export interface ArtworkSuggestions {
  years: string[]
  places: string[]
  locations: string[]
  materials: string[]
  series: string[]
  allTags: string[]
}

interface ArtworkModalProps {
  artwork: Artwork
  tabs: Tab[]
  onClose: () => void
  onUpdate: (updated: Partial<Artwork>) => void
  onDelete?: () => void
  onSaved?: () => void
  onTogglePublic?: (isPublic: boolean) => void
  suggestions?: ArtworkSuggestions
  /** Called when the user clicks 'set as default' on a field in this modal */
  onSetDefault?: (field: keyof UploadDefaults, value: string) => void
  /** Whether the current plan allows individual work sharing (Studio+) */
  canShareWork?: boolean
  /** Open the pricing modal to prompt an upgrade */
  onUpgradeClick?: () => void
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
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontFamily: 'var(--font-body)',
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
  marginBottom: 6,
}

/** Small inline "↑ set as default" button shown next to label after editing a field */
function SetDefaultBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Use this value as the default for future uploads"
      style={{
        background: 'none', border: 'none', padding: '0 0 0 6px',
        cursor: 'pointer', color: 'var(--accent-dim)',
        fontFamily: 'var(--font-body)', fontSize: 10,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        lineHeight: 1, display: 'inline-flex', alignItems: 'center', gap: 3,
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--accent-dim)')}
    >
      ↑ set as default
    </button>
  )
}

export default function ArtworkModal({ artwork, tabs, onClose, onUpdate, onDelete, onSaved, onTogglePublic, suggestions, onSetDefault, canShareWork = false, onUpgradeClick }: ArtworkModalProps) {
  const displayTitle = artwork.title || artwork.aiAnalysis?.suggestedTitle || 'Untitled'
  const medium = artwork.material || artwork.aiAnalysis?.medium

  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [defaultedField, setDefaultedField] = useState<keyof UploadDefaults | null>(null)
  const isPublic = artwork.isPublic ?? false

  const handleSetDefault = (field: keyof UploadDefaults, value: string) => {
    if (!value.trim() || !onSetDefault) return
    onSetDefault(field, value.trim())
    setDefaultedField(field)
    setTimeout(() => setDefaultedField(null), 2000)
  }

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/work/${artwork.id}`
    : `/work/${artwork.id}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2200)
    } catch { /* ignore */ }
  }

  const handleShareX = () => {
    const text = encodeURIComponent(displayTitle)
    const url = encodeURIComponent(shareUrl)
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener,noreferrer')
  }

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`${displayTitle} — ${shareUrl}`)
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  const handleInstagram = async () => {
    try { await navigator.clipboard.writeText(shareUrl) } catch { /* ignore */ }
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer')
  }

  const handleTogglePublic = () => {
    if (!canShareWork) {
      onUpgradeClick?.()
      return
    }
    const next = !isPublic
    onUpdate({ isPublic: next })
    onTogglePublic?.(next)
  }

  const [form, setForm] = useState({
    title:              artwork.title    || artwork.aiAnalysis?.suggestedTitle || '',
    year:               artwork.year     || '',
    place:              artwork.place    || '',
    location:           artwork.location || '',
    width:              artwork.width    || '',
    height:             artwork.height   || '',
    unit:               (artwork.unit    || 'cm') as 'cm' | 'in',
    material:           artwork.material || artwork.aiAnalysis?.medium || '',
    series:             artwork.series   || '',
    tags:               artwork.tags     ?? [],
    mediaType:          artwork.mediaType || (tabs[0]?.id ?? 'painting'),
    copyrightStatus:    artwork.copyrightStatus    || 'automatic' as 'automatic' | 'registered',
    copyrightHolder:    artwork.copyrightHolder    || '',
    copyrightYear:      artwork.copyrightYear      || artwork.year || new Date().getFullYear().toString(),
    copyrightRegNumber: artwork.copyrightRegNumber || '',
    editions:           artwork.editions           || '',
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxOpen) { setLightboxOpen(false); return }
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, lightboxOpen])

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
    <>
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
          borderBottom: shareOpen ? 'none' : '1px solid var(--border)',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Share button */}
            <button
              onClick={() => setShareOpen(s => !s)}
              style={{
                background: shareOpen ? 'rgba(201,169,110,0.08)' : 'none',
                border: `1px solid ${shareOpen ? 'var(--accent-dim)' : 'var(--border)'}`,
                cursor: 'pointer',
                height: 28, padding: '0 10px',
                borderRadius: 2,
                color: shareOpen ? 'var(--accent)' : 'var(--text-dim)',
                fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                fontFamily: 'var(--font-body)',
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                if (shareOpen) return
                e.currentTarget.style.borderColor = 'var(--accent-dim)'
                e.currentTarget.style.color = 'var(--accent)'
              }}
              onMouseLeave={e => {
                if (shareOpen) return
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-dim)'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="9.5" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1"/>
                <circle cx="9.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1"/>
                <circle cx="2.5" cy="6" r="1.5" stroke="currentColor" strokeWidth="1"/>
                <path d="M4 6l4-3.5M4 6l4 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              </svg>
              Share
            </button>

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
        </div>

        {/* ── Share panel ── */}
        {shareOpen && (
          <div style={{
            padding: '14px 24px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(201,169,110,0.03)',
          }}>
            {/* Public toggle row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: isPublic ? 14 : 0,
            }}>
              <div>
                <span style={{
                  fontFamily: 'var(--font-body)', fontSize: 12,
                  color: 'var(--text)', letterSpacing: '0.04em',
                }}>
                  Public share page
                </span>
                <span style={{
                  display: 'block',
                  fontFamily: 'var(--font-body)', fontSize: 11,
                  color: 'var(--muted)', marginTop: 2, letterSpacing: '0.02em',
                }}>
                  {!canShareWork
                    ? 'Individual work sharing requires the Studio plan'
                    : isPublic
                    ? 'Anyone with the link can view this work — voice memo is never shown'
                    : 'Enable to get a shareable link for galleries, collectors & social media'}
                </span>
              </div>

              {/* Toggle switch */}
              <button
                onClick={handleTogglePublic}
                disabled={!canShareWork}
                style={{
                  position: 'relative',
                  width: 40, height: 22, flexShrink: 0,
                  background: isPublic ? 'rgba(201,169,110,0.7)' : 'var(--surface)',
                  border: `1px solid ${isPublic ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 11,
                  cursor: canShareWork ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s, border-color 0.2s',
                  padding: 0,
                  marginLeft: 16,
                  opacity: canShareWork ? 1 : 0.4,
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: 2, left: isPublic ? 20 : 2,
                  width: 16, height: 16, borderRadius: '50%',
                  background: isPublic ? '#0a0a0a' : 'var(--muted)',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* Share actions — only when public */}
            {isPublic && (
              <div>
                {/* URL pill */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 2, padding: '7px 12px',
                }}>
                  <span style={{
                    flex: 1, fontFamily: 'var(--font-body)',
                    fontSize: 12, color: 'var(--text-dim)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    letterSpacing: '0.02em',
                  }}>
                    {shareUrl}
                  </span>
                  <button
                    onClick={handleCopyLink}
                    style={{
                      flexShrink: 0,
                      background: linkCopied ? 'rgba(201,169,110,0.15)' : 'transparent',
                      border: `1px solid ${linkCopied ? 'var(--accent-dim)' : 'var(--border)'}`,
                      borderRadius: 2, padding: '3px 10px',
                      color: linkCopied ? 'var(--accent)' : 'var(--text-dim)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                      cursor: 'pointer', transition: 'all 0.18s',
                    }}
                  >
                    {linkCopied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>

                {/* Social buttons */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {/* X */}
                  <button onClick={handleShareX} style={socialBtnStyle}>
                    <svg width="12" height="12" viewBox="0 0 13 13" fill="currentColor">
                      <path d="M7.65 5.52 11.8 1h-.97L7.2 4.88 4.34 1H1l4.35 6.33L1 12.02h.97l3.8-4.42 3.03 4.42H12L7.65 5.52zm-1.34 1.56-.44-.63L1.68 1.73h1.5l2.82 4.04.44.63 3.66 5.23h-1.5l-2.99-4.55z"/>
                    </svg>
                    X
                  </button>
                  {/* WhatsApp */}
                  <button onClick={handleShareWhatsApp} style={socialBtnStyle}>
                    <svg width="12" height="12" viewBox="0 0 13 13" fill="currentColor">
                      <path d="M6.5 1A5.5 5.5 0 001 6.5c0 .97.26 1.88.7 2.67L1 12l2.97-.67A5.5 5.5 0 106.5 1zm0 1a4.5 4.5 0 110 9 4.5 4.5 0 010-9zM4.3 4.1c-.12 0-.3.04-.46.22-.16.18-.6.59-.6 1.44s.62 1.67.7 1.79c.09.12 1.21 1.87 2.94 2.55 1.44.57 1.74.46 2.05.43.31-.03 1-.41 1.14-.8.14-.4.14-.74.1-.8-.05-.06-.16-.1-.34-.19-.18-.09-.99-.48-1.14-.54-.15-.06-.26-.08-.37.09-.11.17-.42.54-.52.65-.1.11-.2.12-.37.04-.17-.08-.73-.27-1.39-.87-.51-.46-.86-1.02-.96-1.19-.1-.17-.01-.26.07-.35.08-.08.18-.2.27-.3.09-.1.12-.17.18-.29.06-.11.03-.22-.01-.3-.04-.09-.37-.9-.51-1.23-.13-.32-.27-.27-.37-.28H4.3z"/>
                    </svg>
                    WhatsApp
                  </button>
                  {/* Instagram */}
                  <button onClick={handleInstagram} style={socialBtnStyle} title="Copies link to clipboard, then opens Instagram">
                    <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.1">
                      <rect x="1.5" y="1.5" width="10" height="10" rx="2.5"/>
                      <circle cx="6.5" cy="6.5" r="2.5"/>
                      <circle cx="9.7" cy="3.3" r="0.5" fill="currentColor" stroke="none"/>
                    </svg>
                    Instagram
                  </button>
                </div>

                <p style={{
                  marginTop: 8, fontFamily: 'var(--font-body)',
                  fontSize: 10, color: 'var(--muted)', letterSpacing: '0.03em',
                }}>
                  Instagram: link is copied — paste it into your caption or bio.
                </p>
              </div>
            )}
          </div>
        )}

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
            {/* Expand to lightbox */}
            <div
              onClick={() => setLightboxOpen(true)}
              style={{
                position: 'absolute', inset: 0, zIndex: 2,
                cursor: 'zoom-in',
              }}
            />

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={artwork.imageData}
              alt={displayTitle}
              style={{
                width: '100%', height: '100%', maxHeight: 560,
                objectFit: 'contain', display: 'block',
              }}
            />

            {/* Expand icon hint — bottom left */}
            <div style={{
              position: 'absolute', bottom: 10, left: 10, zIndex: 3,
              background: 'rgba(10,10,10,0.55)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 2, padding: '3px 7px',
              display: 'flex', alignItems: 'center', gap: 4,
              backdropFilter: 'blur(4px)',
              pointerEvents: 'none',
            }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1 4V1h3M7 1h3v3M10 7v3H7M4 10H1V7" stroke="rgba(255,255,255,0.5)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

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
              <label style={labelStyle}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M1 2h10M6 2v8"/></svg>
                Title
              </label>
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
              <div>
                <label style={labelStyle}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><rect x="1" y="2" width="10" height="9" rx="1"/><path d="M1 5h10M4 1v2M8 1v2"/></svg>
                  Year
                  {artwork.exifData?.year && !artwork.year && (
                    <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--accent-dim)', letterSpacing: '0.08em' }}>· from photo</span>
                  )}
                </label>
                <SmartInput
                  value={form.year}
                  onChange={v => setForm(f => ({ ...f, year: v }))}
                  suggestions={suggestions?.years ?? []}
                  placeholder="e.g. 2023"
                  inputStyle={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M6 1a3.5 3.5 0 013.5 3.5C9.5 7.5 6 11 6 11S2.5 7.5 2.5 4.5A3.5 3.5 0 016 1z"/><circle cx="6" cy="4.5" r="1.1" fill="currentColor" stroke="none"/></svg>
                  Place
                  {onSetDefault && form.place && (
                    defaultedField === 'place'
                      ? <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em' }}>✓ saved</span>
                      : <SetDefaultBtn onClick={() => handleSetDefault('place', form.place)} />
                  )}
                </label>
                <SmartInput
                  value={form.place}
                  onChange={v => setForm(f => ({ ...f, place: v }))}
                  suggestions={suggestions?.places ?? []}
                  placeholder="e.g. Paris"
                  inputStyle={inputStyle}
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1h4.5l5 5-4.5 4.5L1 6V1z"/><circle cx="3.5" cy="3.5" r="0.8" fill="currentColor" stroke="none"/></svg>
                Tags
              </label>
              <TagEditor
                tags={form.tags}
                allTags={suggestions?.allTags ?? []}
                onChange={tags => setForm(f => ({ ...f, tags }))}
              />
            </div>

            {/* Collection (formerly Category toggle) */}
            {tabs.length > 1 && (
              <div>
                <label style={labelStyle}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4.5h10v6H1z"/><path d="M1 4.5V3.5l3-1.5h2l1 1.5"/></svg>
                  Collection
                </label>
                <select
                  value={form.mediaType}
                  onChange={e => setForm(f => ({ ...f, mediaType: e.target.value }))}
                  style={{
                    ...inputStyle,
                    cursor: 'pointer',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23555' strokeWidth='1.2' fill='none' strokeLinecap='round'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 10px center',
                    paddingRight: 28,
                  }}
                >
                  {tabs.map(tab => (
                    <option key={tab.id} value={tab.id}>{tab.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Editions — photography only */}
            {form.mediaType === 'photography' && (
              <div>
                <label style={labelStyle}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="8" height="8" rx="1"/><path d="M3 3V2a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1h-1"/></svg>
                  Editions
                </label>
                <input
                  type="text"
                  value={form.editions}
                  onChange={e => setForm(f => ({ ...f, editions: e.target.value }))}
                  placeholder="e.g. 20"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
                <p style={{
                  marginTop: 5, fontSize: 11, color: 'var(--muted)',
                  fontFamily: 'var(--font-body)', letterSpacing: '0.04em',
                }}>
                  Total number of prints in this edition
                </p>
              </div>
            )}

            <div>
              <label style={labelStyle}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M2 10c.5-.8 1.5-1.5 3-1.5 1.2 0 2 .5 3-1C9.5 5.5 10 3 8.5 2 7 .5 4.5 1.5 3 3.5 1.5 5.5 2 7 2 8c0 .8-.2 1.5-2 2z"/><circle cx="4.5" cy="4.5" r="1" fill="currentColor" stroke="none"/></svg>
                Material
                {!artwork.material && artwork.aiAnalysis?.medium && (
                  <span style={{
                    marginLeft: 4,
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--accent-dim)',
                    fontWeight: 400,
                  }}>· AI</span>
                )}
                {onSetDefault && form.material && (
                  defaultedField === 'material'
                    ? <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em' }}>✓ saved</span>
                    : <SetDefaultBtn onClick={() => handleSetDefault('material', form.material)} />
                )}
              </label>
              <SmartInput
                value={form.material}
                onChange={v => setForm(f => ({ ...f, material: v }))}
                suggestions={suggestions?.materials ?? []}
                placeholder={form.mediaType === 'photography' ? 'e.g. 35mm Film, Silver gelatin' : 'e.g. Oil on linen, Acrylic'}
                inputStyle={inputStyle}
              />
            </div>

            {/* Location */}
            <div>
              <label style={labelStyle}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><rect x="1" y="1" width="10" height="10" rx="1"/><path d="M1 4h10M4 1v3M4 7h4M4 9h2"/></svg>
                Location
                {onSetDefault && form.location && (
                  defaultedField === 'location'
                    ? <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em' }}>✓ saved</span>
                    : <SetDefaultBtn onClick={() => handleSetDefault('location', form.location)} />
                )}
              </label>
              <SmartInput
                value={form.location}
                onChange={v => setForm(f => ({ ...f, location: v }))}
                suggestions={suggestions?.locations ?? []}
                placeholder="e.g. Studio storage, Home — living room, Bank vault"
                inputStyle={inputStyle}
              />
              <p style={{
                marginTop: 5, fontSize: 11, color: 'var(--muted)',
                fontFamily: 'var(--font-body)', letterSpacing: '0.04em',
              }}>
                Used for provenance records, insurance &amp; estate documentation
              </p>
            </div>

            {/* Series */}
            <div>
              <label style={labelStyle}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><path d="M2 3.5h8M2 6h8M2 8.5h8"/></svg>
                Series
                {onSetDefault && form.series && (
                  defaultedField === 'series'
                    ? <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em' }}>✓ saved</span>
                    : <SetDefaultBtn onClick={() => handleSetDefault('series', form.series)} />
                )}
              </label>
              <SmartInput
                value={form.series}
                onChange={v => setForm(f => ({ ...f, series: v }))}
                suggestions={suggestions?.series ?? []}
                placeholder="e.g. Coastline Studies, Winter Portraits"
                inputStyle={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="10" height="4" rx="0.5"/><path d="M3 4V3M5 4V2.5M7 4V3M9 4V2.5"/></svg>
                Dimensions
              </label>
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
              {/* Pixel dimensions hint — sourced from EXIF, read-only */}
              {(artwork.exifData?.pixelWidth && artwork.exifData?.pixelHeight) && (
                <p style={{
                  marginTop: 5, fontSize: 11, color: 'var(--muted)',
                  fontFamily: 'var(--font-body)', letterSpacing: '0.04em',
                }}>
                  {artwork.exifData.pixelWidth.toLocaleString()} × {artwork.exifData.pixelHeight.toLocaleString()} px (original file)
                </p>
              )}
            </div>

            <hr className="gold-rule" />

            {/* Copyright */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: 10,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'var(--accent-dim)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <svg width="11" height="12" viewBox="0 0 12 13" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 1L1 3v4c0 3 2.2 5 5 5.5 2.8-.5 5-2.5 5-5.5V3L6 1z"/></svg>
                Copyright
              </div>

              {/* Status dropdown */}
              <div>
                <label style={labelStyle}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 1L1.5 3v3c0 2.8 2 4.8 4.5 5.2C10.5 10.8 10.5 9 10.5 6V3L6 1z"/><path d="M4 6l1.5 1.5L8 4"/></svg>
                  Level
                </label>
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
                  <label style={labelStyle}>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><circle cx="6" cy="4" r="2.5"/><path d="M1.5 11c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"/></svg>
                    Holder
                  </label>
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
                  <label style={labelStyle}>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><rect x="1" y="2" width="10" height="9" rx="1"/><path d="M1 5h10M4 1v2M8 1v2"/></svg>
                    Year
                  </label>
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
                  <label style={labelStyle}>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><rect x="2" y="1" width="8" height="10" rx="1"/><path d="M4 4h4M4 6h4M4 8h2"/></svg>
                    Reg. No.
                  </label>
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
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor"><path d="M6 1l1.1 3.1L10.5 5.5 7.4 6.6 6.3 10l-1.1-3.4L1.5 5.5l3.4-1.3L6 1z"/></svg>
                  Analysis
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
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"><rect x="4" y="1" width="4" height="6" rx="2"/><path d="M2 6.5c0 2 1.8 3.5 4 3.5s4-1.5 4-3.5M6 10v1.5M4 11.5h4"/></svg>
                Story
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
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-5"/></svg>
                Save to Catalogue
              </span>
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
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3.5h8M5 1.5h2M4.5 3.5V10M7.5 3.5V10M2 3.5l.5 7h7l.5-7"/></svg>
                  Remove
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>

    {lightboxOpen && (
      <ArtworkLightbox
        src={artwork.imageData}
        alt={displayTitle}
        onClose={() => setLightboxOpen(false)}
      />
    )}
  </>
  )
}

const socialBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '5px 12px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 2,
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-body)',
  fontSize: 11, letterSpacing: '0.08em',
  cursor: 'pointer',
  transition: 'border-color 0.18s, color 0.18s',
}
