'use client'

import { useState } from 'react'
import { Artwork } from '@/lib/types'

interface ArtworkCardProps {
  artwork: Artwork
  onClick: () => void
  selectionMode?: boolean
  isSelected?: boolean
  onSelect?: (id: string) => void
}

function MediaIcon({ mediaType, material }: { mediaType: string; material?: string }) {
  const t = (mediaType || '').toLowerCase()
  const m = (material || '').toLowerCase()

  // Photography / film — camera body with lens circle
  if (t.includes('photo') || t.includes('film') || t.includes('cinema') ||
      m.includes('photo') || m.includes('film')) return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3.5" width="10" height="7" rx="1"/>
      <path d="M4.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1"/>
      <circle cx="6" cy="7" r="2"/>
      <circle cx="6" cy="7" r="0.7" fill="currentColor" stroke="none"/>
    </svg>
  )

  // Drawing / sketch / ink — pencil (horizontal, clearly a pencil shape)
  if (t.includes('draw') || t.includes('sketch') || t.includes('pencil') ||
      m.includes('pencil') || m.includes('charcoal') || m.includes('graphite') || m.includes('ink')) return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4.5" width="7" height="3" rx="0.5"/>
      <path d="M9 4.5l1.5 1.5L9 7.5"/>
      <path d="M2 4.5L1 6l1 1.5"/>
      <line x1="2" y1="6" x2="9" y2="6"/>
    </svg>
  )

  // Sculpture / ceramics — 3D box
  if (t.includes('sculpt') || t.includes('ceramic') || t.includes('potter') ||
      m.includes('bronze') || m.includes('marble') || m.includes('clay') || m.includes('ceramic')) return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 1.5l4 2v4l-4 2-4-2v-4z"/>
      <path d="M6 1.5v8M2 3.5l4 2 4-2"/>
    </svg>
  )

  // Digital / generative — monitor with cursor
  if (t.includes('digital') || t.includes('vector') || t.includes('generative') || t.includes('nft') ||
      m.includes('digital')) return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1.5" width="10" height="7" rx="1"/>
      <path d="M4 11h4M6 8.5V11"/>
      <path d="M4 5l1.5 1.5L7.5 4" strokeWidth="1.1"/>
    </svg>
  )

  // Printmaking — layered sheets
  if (t.includes('print') || t.includes('etching') || t.includes('lithograph') || t.includes('screen') || t.includes('woodcut') ||
      m.includes('etching') || m.includes('lithograph') || m.includes('screen print')) return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="1" width="7" height="5" rx="0.8"/>
      <rect x="1.5" y="2.5" width="7" height="5" rx="0.8"/>
      <rect x="1" y="6" width="7" height="5" rx="0.8"/>
    </svg>
  )

  // Watercolour / gouache / pastel — water drop
  if (t.includes('water') || t.includes('gouache') || t.includes('pastel') ||
      m.includes('watercolour') || m.includes('watercolor') || m.includes('gouache') || m.includes('pastel')) return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 1.5C6 1.5 2.5 5.5 2.5 8a3.5 3.5 0 007 0C9.5 5.5 6 1.5 6 1.5z"/>
      <path d="M4.5 8.5a1.5 1.5 0 001.5 1" strokeWidth="1" opacity="0.6"/>
    </svg>
  )

  // Collage / mixed media
  if (t.includes('collage') || t.includes('mixed') || t.includes('assemblage') ||
      m.includes('collage') || m.includes('mixed')) return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="4.5" height="4.5" rx="0.8"/>
      <rect x="6.5" y="1" width="4.5" height="4.5" rx="0.8"/>
      <rect x="1" y="6.5" width="10" height="4.5" rx="0.8"/>
    </svg>
  )

  // Default: painting — palette shape (oval with thumb hole + paint dots)
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 1.5C3.5 1.5 1.5 3.3 1.5 5.5c0 1.5.8 2.8 2 3.5.7.4 1.2 1 1.2 1.8 0 .7.5 1.2 1.2 1.2a4.5 4.5 0 100-9z"/>
      <circle cx="4" cy="4.5" r="0.7" fill="currentColor" stroke="none"/>
      <circle cx="7" cy="3.5" r="0.7" fill="currentColor" stroke="none"/>
      <circle cx="9" cy="5.5" r="0.7" fill="currentColor" stroke="none"/>
    </svg>
  )
}

export default function ArtworkCard({ artwork, onClick, selectionMode, isSelected, onSelect }: ArtworkCardProps) {
  const [hovered, setHovered] = useState(false)
  const title = artwork.title || artwork.aiAnalysis?.suggestedTitle || ''
  const isProcessing = artwork.status === 'uploading' || artwork.status === 'analyzing'
  const isComplete = artwork.status === 'complete'
  const isUntitled = !title

  const handleClick = () => {
    if (isProcessing) return
    if (selectionMode && onSelect) {
      onSelect(artwork.id)
    } else {
      onClick()
    }
  }

  const showCheckbox = selectionMode || hovered

  return (
    <div
      onClick={handleClick}
      onMouseEnter={e => {
        setHovered(true)
        if (isProcessing || selectionMode) return
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = 'var(--accent-dim)'
        el.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        setHovered(false)
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = isSelected ? 'var(--accent)' : 'var(--border)'
        el.style.transform = 'translateY(0)'
      }}
      style={{
        background: 'var(--card)',
        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 2,
        overflow: 'hidden',
        cursor: isProcessing ? 'default' : 'pointer',
        transition: 'border-color 0.22s, transform 0.22s, box-shadow 0.22s',
        animation: 'fadeUp 0.4s ease forwards',
        opacity: 0,
        boxShadow: isSelected ? '0 0 0 2px rgba(201,169,110,0.25)' : undefined,
        position: 'relative',
      }}
    >
      {/* Image pane */}
      <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden', background: 'var(--surface)' }}>

        {/* Selection checkbox */}
        {!isProcessing && showCheckbox && (
          <div
            onClick={e => { e.stopPropagation(); onSelect?.(artwork.id) }}
            style={{
              position: 'absolute', top: 9, left: 9, zIndex: 10,
              width: 20, height: 20, borderRadius: 4,
              background: isSelected ? 'var(--accent)' : 'rgba(10,10,10,0.6)',
              border: `1.5px solid ${isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.45)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s, border-color 0.15s',
              backdropFilter: 'blur(4px)',
            }}
          >
            {isSelected && (
              <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                <path d="M1 4l3.5 3.5L10 1" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artwork.imageData}
          alt={title || artwork.fileName}
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
            opacity: isProcessing ? 0.25 : 1,
            transition: 'transform 0.5s ease, opacity 0.3s',
          }}
        />

        {/* Analyzing overlay — wave bars */}
        {isProcessing && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(10,10,10,0.72)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 0.1, 0.2, 0.3, 0.4].map((delay, i) => (
                <div key={i} style={{
                  width: 3, height: 18,
                  background: 'var(--accent)',
                  borderRadius: 2,
                  animation: `wave 1s ease-in-out ${delay}s infinite`,
                }} />
              ))}
            </div>
            <span style={{
              fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: 'var(--accent)', fontFamily: 'var(--font-body)',
            }}>
              {artwork.status === 'uploading' ? 'Uploading' : 'Analysing'}
            </span>
          </div>
        )}

        {/* Color palette — bottom right */}
        {!isProcessing && artwork.aiAnalysis?.colorPalette?.length ? (
          <div style={{
            position: 'absolute', bottom: 8, right: 8,
            display: 'flex', gap: 3,
          }}>
            {artwork.aiAnalysis.colorPalette.slice(0, 5).map((hex, i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: '50%',
                background: hex,
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
              }} />
            ))}
          </div>
        ) : null}

        {/* Story badge — top right */}
        {artwork.voiceMemo && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(201,169,110,0.15)',
            border: '1px solid var(--accent-dim)',
            borderRadius: 2, padding: '2px 7px',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <svg width="7" height="7" viewBox="0 0 7 7" fill="var(--accent)">
              <circle cx="3.5" cy="3.5" r="3.5"/>
            </svg>
            <span style={{
              fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--accent)', fontFamily: 'var(--font-body)',
            }}>
              Story
            </span>
          </div>
        )}

        {/* Complete dot — top left (hidden when checkbox is visible) */}
        {isComplete && !showCheckbox && (
          <div style={{
            position: 'absolute', top: 9, left: 9,
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--accent)', opacity: 0.85,
          }} />
        )}
      </div>

      {/* Card info */}
      <div style={{
        padding: '14px 16px 18px',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18, fontStyle: 'italic', fontWeight: 400,
          color: isUntitled ? 'var(--muted)' : 'var(--text)',
          marginBottom: 8,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {isProcessing
            ? 'Analysing…'
            : isUntitled
            ? 'Untitled'
            : title}
        </div>

        {/* Tags row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {artwork.year && (
            <span className="tag" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
                <rect x="1" y="1.5" width="8" height="7.5" rx="0.8"/>
                <path d="M1 4h8M3.5 1v1.5M6.5 1v1.5"/>
              </svg>
              {artwork.year}
            </span>
          )}
          {artwork.place && (
            <span className="tag" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="8" height="9" viewBox="0 0 9 11" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
                <path d="M4.5 1A3 3 0 011.5 4C1.5 6.5 4.5 10 4.5 10S7.5 6.5 7.5 4A3 3 0 014.5 1z"/>
                <circle cx="4.5" cy="4" r="1" fill="currentColor" stroke="none"/>
              </svg>
              {artwork.place}
            </span>
          )}
          {(artwork.material || artwork.aiAnalysis?.medium) && (
            <span
              className="tag tag-gold"
              title={artwork.material || artwork.aiAnalysis?.medium}
              style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '2px 7px' }}
            >
              <MediaIcon mediaType={artwork.mediaType || ''} material={artwork.material || artwork.aiAnalysis?.medium} />
            </span>
          )}
          {isUntitled && !isProcessing && (
            <span className="tag" style={{ color: 'var(--muted)' }}>Needs details</span>
          )}
          {isProcessing && (
            <span className="tag">Just uploaded</span>
          )}
        </div>

        {/* Sub line: style · subject */}
        {(artwork.aiAnalysis?.subject || artwork.aiAnalysis?.style) && (
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.02em',
          }}>
            {[artwork.aiAnalysis.subject, artwork.aiAnalysis.style].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
    </div>
  )
}
