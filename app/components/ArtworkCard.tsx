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
            <span className="tag">{artwork.year}</span>
          )}
          {artwork.place && (
            <span className="tag">{artwork.place}</span>
          )}
          {(artwork.material || artwork.aiAnalysis?.medium) && (
            <span className="tag tag-gold">{artwork.material || artwork.aiAnalysis?.medium}</span>
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
