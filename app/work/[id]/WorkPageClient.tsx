'use client'

import { useState } from 'react'

interface WorkRow {
  id: string
  image_url: string
  title: string
  year: string
  place: string
  width: string
  height: string
  unit: string
  material: string
  ai_analysis?: {
    style?: string
    description?: string
    subject?: string
    colorPalette?: string[]
  }
  copyright_holder: string
  copyright_year: string
  is_public: boolean
}

function buildShareUrl(id: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/work/${id}`
  }
  return `/work/${id}`
}

export default function WorkPageClient({ work }: { work: WorkRow }) {
  const [copied, setCopied] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const title = work.title || 'Untitled'
  const shareUrl = buildShareUrl(work.id)

  const metaLine = [work.year, work.material, work.place].filter(Boolean).join(' · ')
  const dims = work.width && work.height
    ? `${work.width} × ${work.height} ${work.unit}`
    : null

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      /* fallback: silently ignore */
    }
  }

  const handleShareX = () => {
    const text = encodeURIComponent(`${title}${work.year ? ' (' + work.year + ')' : ''}`)
    const url = encodeURIComponent(shareUrl)
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener,noreferrer')
  }

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`${title} — ${shareUrl}`)
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  const handleInstagram = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch { /* ignore */ }
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <main style={{ minHeight: '100vh', background: '#0a0a0a', color: 'var(--text, #e8e8e8)' }}>

        {/* Hero image */}
        <div
          style={{
            background: '#080808',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '48px 24px 40px',
            minHeight: '55vh',
            cursor: 'zoom-in',
          }}
          onClick={() => setLightboxOpen(true)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={work.image_url}
            alt={title}
            style={{
              maxWidth: '100%',
              maxHeight: '65vh',
              objectFit: 'contain',
              display: 'block',
              boxShadow: '0 32px 100px rgba(0,0,0,0.7)',
            }}
          />
        </div>

        {/* Content */}
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '44px 28px 72px' }}>

          {/* Title */}
          <h1 style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 36, fontWeight: 400, fontStyle: 'italic',
            color: '#e8e8e8', margin: '0 0 12px',
            lineHeight: 1.2,
          }}>
            {title}
          </h1>

          {/* Meta line */}
          {metaLine && (
            <p style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 14, letterSpacing: '0.06em',
              color: 'rgba(232,232,232,0.5)',
              margin: '0 0 6px',
            }}>
              {metaLine}
            </p>
          )}

          {/* Dimensions */}
          {dims && (
            <p style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 13, color: 'rgba(232,232,232,0.35)',
              margin: '0 0 28px', letterSpacing: '0.04em',
            }}>
              {dims}
            </p>
          )}

          {/* Color palette */}
          {work.ai_analysis?.colorPalette?.length ? (
            <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
              {work.ai_analysis.colorPalette.map((hex, i) => (
                <div key={i} style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: hex,
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                }} />
              ))}
            </div>
          ) : null}

          {/* AI description */}
          {work.ai_analysis?.description && (
            <blockquote style={{
              borderLeft: '2px solid rgba(201,169,110,0.4)',
              margin: '0 0 36px', padding: '0 0 0 20px',
            }}>
              <p style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 18, fontStyle: 'italic',
                color: 'rgba(232,232,232,0.65)', lineHeight: 1.7,
                margin: 0,
              }}>
                &ldquo;{work.ai_analysis.description}&rdquo;
              </p>
            </blockquote>
          )}

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginBottom: 32 }} />

          {/* Social share strip */}
          <div>
            <p style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'rgba(232,232,232,0.35)', marginBottom: 14,
            }}>
              Share this work
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

              {/* Copy link */}
              <button
                onClick={handleCopyLink}
                style={shareBtn(copied)}
              >
                {copied ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M2 6.5l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M5 8l1.5-1.5M8 5l1.5-1.5A2.83 2.83 0 105.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      <path d="M8 8l-1.5 1.5A2.83 2.83 0 107.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    Copy link
                  </>
                )}
              </button>

              {/* X / Twitter */}
              <button onClick={handleShareX} style={shareBtn(false)}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
                  <path d="M7.65 5.52 11.8 1h-.97L7.2 4.88 4.34 1H1l4.35 6.33L1 12.02h.97l3.8-4.42 3.03 4.42H12L7.65 5.52zm-1.34 1.56-.44-.63L1.68 1.73h1.5l2.82 4.04.44.63 3.66 5.23h-1.5l-2.99-4.55z"/>
                </svg>
                Share on X
              </button>

              {/* WhatsApp */}
              <button onClick={handleShareWhatsApp} style={shareBtn(false)}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor">
                  <path d="M6.5 1A5.5 5.5 0 001 6.5c0 .97.26 1.88.7 2.67L1 12l2.97-.67A5.5 5.5 0 106.5 1zm0 1a4.5 4.5 0 110 9 4.5 4.5 0 010-9zM4.3 4.1c-.12 0-.3.04-.46.22-.16.18-.6.59-.6 1.44s.62 1.67.7 1.79c.09.12 1.21 1.87 2.94 2.55 1.44.57 1.74.46 2.05.43.31-.03 1-.41 1.14-.8.14-.4.14-.74.1-.8-.05-.06-.16-.1-.34-.19-.18-.09-.99-.48-1.14-.54-.15-.06-.26-.08-.37.09-.11.17-.42.54-.52.65-.1.11-.2.12-.37.04-.17-.08-.73-.27-1.39-.87-.51-.46-.86-1.02-.96-1.19-.1-.17-.01-.26.07-.35.08-.08.18-.2.27-.3.09-.1.12-.17.18-.29.06-.11.03-.22-.01-.3-.04-.09-.37-.9-.51-1.23-.13-.32-.27-.27-.37-.28H4.3z"/>
                </svg>
                WhatsApp
              </button>

              {/* Instagram */}
              <button onClick={handleInstagram} style={shareBtn(false)} title="Copies link to clipboard, then opens Instagram">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.1">
                  <rect x="1.5" y="1.5" width="10" height="10" rx="2.5"/>
                  <circle cx="6.5" cy="6.5" r="2.5"/>
                  <circle cx="9.7" cy="3.3" r="0.5" fill="currentColor" stroke="none"/>
                </svg>
                Instagram
              </button>
            </div>

            {/* Instagram note */}
            <p style={{
              marginTop: 10,
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 11, color: 'rgba(232,232,232,0.3)',
              letterSpacing: '0.03em', lineHeight: 1.5,
            }}>
              Instagram: link is copied to your clipboard — paste it in your caption or bio.
            </p>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 56, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 22 }}>
            {(work.copyright_holder || work.copyright_year) && (
              <p style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 12, color: 'rgba(232,232,232,0.25)',
                letterSpacing: '0.03em', marginBottom: 12,
              }}>
                © {work.copyright_year} {work.copyright_holder}
              </p>
            )}
            <p style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 11, color: 'rgba(232,232,232,0.2)',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              Catalogued with ArtisTrust
            </p>
          </div>
        </div>
      </main>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.97)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={work.image_url}
            alt={title}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '95vw', maxHeight: '95vh',
              objectFit: 'contain', cursor: 'default',
              boxShadow: '0 40px 120px rgba(0,0,0,0.8)',
            }}
          />
          <button
            onClick={() => setLightboxOpen(false)}
            style={{
              position: 'fixed', top: 20, right: 24,
              background: 'rgba(10,10,10,0.6)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 2, width: 36, height: 36,
              color: 'rgba(255,255,255,0.7)', fontSize: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', backdropFilter: 'blur(8px)',
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}

function shareBtn(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px',
    background: active ? 'rgba(201,169,110,0.12)' : 'transparent',
    border: `1px solid ${active ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: 2,
    color: active ? 'rgba(201,169,110,0.9)' : 'rgba(232,232,232,0.55)',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 12, letterSpacing: '0.04em',
    cursor: 'pointer',
    transition: 'all 0.18s',
  }
}
