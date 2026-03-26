'use client'

import { useEffect } from 'react'

interface ArtworkLightboxProps {
  src: string
  alt: string
  onClose: () => void
}

export default function ArtworkLightbox({ src, alt, onClose }: ArtworkLightboxProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.95)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out',
        animation: 'fadeIn 0.18s ease',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '95vw',
          maxHeight: '95vh',
          objectFit: 'contain',
          cursor: 'default',
          boxShadow: '0 40px 120px rgba(0,0,0,0.8)',
        }}
      />

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed', top: 20, right: 24,
          background: 'rgba(10,10,10,0.6)',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: 2,
          width: 36, height: 36,
          color: 'rgba(255,255,255,0.7)',
          fontSize: 20, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          transition: 'border-color 0.18s, color 0.18s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'
          e.currentTarget.style.color = '#fff'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
          e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
        }}
      >
        ×
      </button>
    </div>
  )
}
