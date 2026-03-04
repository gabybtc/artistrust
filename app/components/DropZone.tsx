'use client'

import { useCallback, useRef, useState } from 'react'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  label?: string
}

export default function DropZone({ onFiles, label = 'Drag paintings here' }: DropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const images = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (images.length) onFiles(images)
  }, [onFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const neon = '#ffe600'

  const cornerStyle = (pos: 'tl' | 'tr' | 'bl' | 'br'): React.CSSProperties => ({
    position: 'absolute',
    width: 10, height: 10,
    ...(pos === 'tl' ? { top: 7, left: 7, borderTop: `1px solid ${neon}`, borderLeft: `1px solid ${neon}` } : {}),
    ...(pos === 'tr' ? { top: 7, right: 7, borderTop: `1px solid ${neon}`, borderRight: `1px solid ${neon}` } : {}),
    ...(pos === 'bl' ? { bottom: 7, left: 7, borderBottom: `1px solid ${neon}`, borderLeft: `1px solid ${neon}` } : {}),
    ...(pos === 'br' ? { bottom: 7, right: 7, borderBottom: `1px solid ${neon}`, borderRight: `1px solid ${neon}` } : {}),
    opacity: dragging ? 1 : 0.6,
    transition: 'opacity 0.2s',
  })

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        position: 'relative',
        border: `1px dashed ${dragging ? neon : 'rgba(255,230,0,0.35)'}`,
        boxShadow: dragging ? `0 0 12px rgba(255,230,0,0.15)` : 'none',
        borderRadius: 2,
        padding: '20px 40px',
        textAlign: 'center',
        cursor: 'pointer',
        background: dragging ? 'rgba(255,230,0,0.02)' : 'var(--surface)',
        transition: 'all 0.25s',
        userSelect: 'none',
      }}
    >
      {/* Corner decorations */}
      <div style={cornerStyle('tl')} />
      <div style={cornerStyle('tr')} />
      <div style={cornerStyle('bl')} />
      <div style={cornerStyle('br')} />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />

      {/* Icon + label */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <svg
          width="26" height="26" viewBox="0 0 40 40" fill="none"
          style={{ opacity: dragging ? 0.9 : 0.45, flexShrink: 0, transition: 'opacity 0.2s' }}
        >
          <rect x="4" y="8" width="32" height="24" rx="2" stroke={neon} strokeWidth="1.4"/>
          <circle cx="14" cy="16" r="3.5" stroke={neon} strokeWidth="1.4"/>
          <path d="M4 26l10-8 7 5 5-4 14 9" stroke={neon} strokeWidth="1.4" strokeLinejoin="round"/>
        </svg>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 17, fontStyle: 'italic', fontWeight: 400,
            color: dragging ? neon : 'var(--text)',
            transition: 'color 0.2s', margin: 0, lineHeight: 1.3,
          }}>
            {dragging ? 'Release to add works' : label}
          </h2>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--muted)', margin: '3px 0 0',
          }}>
            or click to browse
          </p>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--muted)', margin: '2px 0 0',
          }}>
            JPG · PNG · WEBP
          </p>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--muted)', margin: '2px 0 0',
          }}>
            Max 10 at once
          </p>
        </div>
      </div>
    </div>
  )
}

