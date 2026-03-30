"use client"
import { useState, useRef, useCallback, useMemo } from 'react'
import { Artwork } from '@/lib/types'

// ── Cluster modes ─────────────────────────────────────────────────────────────

type ClusterMode = 'colour' | 'period' | 'medium' | 'style' | 'region'

const CLUSTER_MODES: { id: ClusterMode; label: string }[] = [
  { id: 'colour',  label: 'Colour'  },
  { id: 'period',  label: 'Period'  },
  { id: 'medium',  label: 'Medium'  },
  { id: 'style',   label: 'Style'   },
  { id: 'region',  label: 'Region'  },
]

// ── Colour math ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '')
  // Expand 3-digit hex (#abc → #aabbcc)
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean
  const m = full.match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return null
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: h * 360, s, l }
}

function dominantHsl(palette: string[]): { h: number; s: number; l: number } | null {
  // Use the most saturated colour in the palette as the dominant for placement
  let best: { h: number; s: number; l: number } | null = null
  for (const hex of palette) {
    const rgb = hexToRgb(hex)
    if (!rgb) continue
    const hsl = rgbToHsl(...rgb)
    if (!best || hsl.s > best.s) best = hsl
  }
  return best
}

// Deterministic per-artwork jitter so stacked items spread slightly
function idJitter(id: string, maxPx: number): { dx: number; dy: number } {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  const angle = ((hash >>> 0) % 628) / 100
  const mag = (((hash >>> 8) & 0xff) / 255) * maxPx
  return { dx: Math.cos(angle) * mag, dy: Math.sin(angle) * mag }
}

// ── Board geometry ────────────────────────────────────────────────────────────
const BOARD = 680
const THUMB = 68
const MAX_R = 268
const CX = BOARD / 2
const CY = BOARD / 2
const REPEL_R = 140
const MAX_PUSH = 64

function hslToPos(hsl: { h: number; s: number; l: number }): { x: number; y: number } {
  const angle = ((hsl.h - 90) / 360) * 2 * Math.PI
  const r = Math.max(0.1, hsl.s) * MAX_R
  return {
    x: CX + r * Math.cos(angle) - THUMB / 2,
    y: CY + r * Math.sin(angle) - THUMB / 2,
  }
}

// Hue labels around the rim
const HUE_LABELS = [
  { label: 'Red',     h: 0   },
  { label: 'Orange',  h: 30  },
  { label: 'Yellow',  h: 60  },
  { label: 'Green',   h: 120 },
  { label: 'Teal',    h: 168 },
  { label: 'Blue',    h: 225 },
  { label: 'Violet',  h: 270 },
  { label: 'Pink',    h: 320 },
]


// ── Spoke-layout for categorical modes ───────────────────────────────────────

function spokeLayout(
  artworks: Artwork[],
  keyFn: (a: Artwork) => string,
): Array<{ artwork: Artwork; bx: number; by: number; key: string }> {
  const groups = new Map<string, Artwork[]>()
  for (const a of artworks) {
    const k = keyFn(a) || 'Unknown'
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(a)
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)
  const n = sorted.length
  const result: Array<{ artwork: Artwork; bx: number; by: number; key: string }> = []

  sorted.forEach(([key, members], groupIdx) => {
    const angle = ((groupIdx / n) * 2 * Math.PI) - Math.PI / 2
    members.forEach((artwork, itemIdx) => {
      const jitter = idJitter(artwork.id, 14)
      const step = Math.min(76, (MAX_R * 0.72) / Math.max(members.length, 1))
      const r = MAX_R * 0.28 + itemIdx * step
      const cx = CX + r * Math.cos(angle)
      const cy = CY + r * Math.sin(angle)
      result.push({
        artwork,
        key,
        bx: Math.max(2, Math.min(BOARD - THUMB - 2, cx - THUMB / 2 + jitter.dx)),
        by: Math.max(2, Math.min(BOARD - THUMB - 2, cy - THUMB / 2 + jitter.dy)),
      })
    })
  })
  return result
}

function spokeLabels(
  artworks: Artwork[],
  keyFn: (a: Artwork) => string,
): Array<{ key: string; count: number; lx: number; ly: number }> {
  const groups = new Map<string, number>()
  for (const a of artworks) {
    const k = keyFn(a) || 'Unknown'
    groups.set(k, (groups.get(k) ?? 0) + 1)
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1])
  const n = sorted.length
  return sorted.map(([key, count], i) => {
    const angle = ((i / n) * 2 * Math.PI) - Math.PI / 2
    const r = MAX_R + 24
    return { key, count, lx: CX + r * Math.cos(angle), ly: CY + r * Math.sin(angle) }
  })
}

function keyForMode(mode: ClusterMode, artwork: Artwork): string {
  switch (mode) {
    case 'period': {
      const y = parseInt(artwork.year ?? '', 10)
      if (isNaN(y)) return 'Unknown'
      return `${Math.floor(y / 10) * 10}s`
    }
    case 'medium': {
      const raw = artwork.material || artwork.aiAnalysis?.medium || ''
      if (!raw) return 'Unknown'
      return raw.split(',')[0].trim().split(/\s+/).slice(0, 3).join(' ')
    }
    case 'style':
      return artwork.aiAnalysis?.style || 'Unknown'
    case 'region': {
      const raw = artwork.place || ''
      if (!raw) return 'Unknown'
      const parts = raw.split(/[,/]/).map((s: string) => s.trim()).filter(Boolean)
      return parts[parts.length - 1] || raw
    }
    default:
      return ''
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  artworks: Artwork[]
  onSelect: (artwork: Artwork) => void
}

export default function ColourClusterView({ artworks, onSelect }: Props) {
  const [mode, setMode] = useState<ClusterMode>('colour')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const wheelRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = wheelRef.current?.getBoundingClientRect()
    if (!rect) return
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [])

  const handleMouseLeave = useCallback(() => setMousePos(null), [])

  const { colourPlaced, colourUnplaced } = useMemo(() => {
    const placed: Array<{ artwork: Artwork; bx: number; by: number }> = []
    const unplaced: Artwork[] = []
    for (const artwork of artworks) {
      const palette = artwork.aiAnalysis?.colorPalette
      if (!palette || palette.length === 0) { unplaced.push(artwork); continue }
      const hsl = dominantHsl(palette)
      if (!hsl || hsl.s < 0.04) { unplaced.push(artwork); continue }
      const jitter = idJitter(artwork.id, 20)
      const { x, y } = hslToPos(hsl)
      placed.push({
        artwork,
        bx: Math.max(4, Math.min(BOARD - THUMB - 4, x + jitter.dx)),
        by: Math.max(4, Math.min(BOARD - THUMB - 4, y + jitter.dy)),
      })
    }
    return { colourPlaced: placed, colourUnplaced: unplaced }
  }, [artworks])

  const spokePlaced = useMemo(() =>
    mode !== 'colour' ? spokeLayout(artworks, a => keyForMode(mode, a)) : []
  , [artworks, mode])

  const spokeLabelsData = useMemo(() =>
    mode !== 'colour' ? spokeLabels(artworks, a => keyForMode(mode, a)) : []
  , [artworks, mode])

  const allPlaced = mode === 'colour' ? colourPlaced : spokePlaced

  const hoveredArtwork = allPlaced.find(p => p.artwork.id === hoveredId)?.artwork
    ?? (mode === 'colour' ? colourUnplaced.find(a => a.id === hoveredId) : undefined)

  const subtitles: Record<ClusterMode, string> = {
    colour:  'Hue → angle · Saturation → distance from centre',
    period:  'Decade → spoke · Works per decade spread outward',
    medium:  'Medium → spoke · Most-used media closest to top',
    style:   'Style → spoke · Most common styles closest to top',
    region:  'Place / region → spoke · Most-visited closest to top',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>

      {/* Mode switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {CLUSTER_MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            style={{
              background: mode === m.id ? 'rgba(201,169,110,0.12)' : 'transparent',
              border: `1px solid ${mode === m.id ? 'var(--accent-dim)' : 'var(--border)'}`,
              borderRadius: 2, padding: '5px 14px',
              fontFamily: 'var(--font-body)',
              fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: mode === m.id ? 'var(--accent)' : 'var(--text-dim)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              if (mode !== m.id) {
                e.currentTarget.style.borderColor = 'var(--accent-dim)'
                e.currentTarget.style.color = 'var(--text)'
              }
            }}
            onMouseLeave={e => {
              if (mode !== m.id) {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-dim)'
              }
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Subtitle */}
      <p style={{
        fontFamily: 'var(--font-body)', fontSize: 11,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: 'var(--muted)', marginBottom: 4,
      }}>
        {subtitles[mode]}
      </p>

      {/* Hover title bar */}
      <div style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
        {hoveredArtwork?.title && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text)', letterSpacing: '0.04em' }}>
            {hoveredArtwork.title}
            {hoveredArtwork.year
              ? <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>{hoveredArtwork.year}</span>
              : null}
          </span>
        )}
      </div>

      {/* Wheel */}
      <div
        ref={wheelRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'relative',
          width: BOARD, height: BOARD,
          borderRadius: mode === 'colour' ? '50%' : 12,
          border: '1px solid var(--border)',
          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.025) 0%, transparent 70%)',
          flexShrink: 0,
          cursor: 'crosshair',
          transition: 'border-radius 0.3s',
        }}
      >
        {/* Axis lines */}
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        {/* Colour-mode extras */}
        {mode === 'colour' && (
          <>
            {[0.33, 0.66, 1].map(s => (
              <div key={s} style={{
                position: 'absolute', borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.045)',
                width: s * MAX_R * 2, height: s * MAX_R * 2,
                left: CX - s * MAX_R, top: CY - s * MAX_R,
                pointerEvents: 'none',
              }} />
            ))}
            {HUE_LABELS.map(({ label, h }) => {
              const angle = ((h - 90) / 360) * 2 * Math.PI
              const r = MAX_R - 18
              return (
                <span key={h} style={{
                  position: 'absolute',
                  left: CX + r * Math.cos(angle),
                  top: CY + r * Math.sin(angle),
                  transform: 'translate(-50%, -50%)',
                  fontFamily: 'var(--font-body)', fontSize: 10,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: `hsl(${h}, 50%, 58%)`,
                  pointerEvents: 'none', whiteSpace: 'nowrap', userSelect: 'none',
                }}>
                  {label}
                </span>
              )
            })}
            <span style={{
              position: 'absolute', left: CX, top: CY,
              transform: 'translate(-50%, -50%)',
              fontFamily: 'var(--font-body)', fontSize: 10,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.1)',
              pointerEvents: 'none', userSelect: 'none',
            }}>
              Grey
            </span>
          </>
        )}

        {/* Spoke-mode labels */}
        {mode !== 'colour' && spokeLabelsData.map(({ key, count, lx, ly }) => (
          <span key={key} style={{
            position: 'absolute',
            left: lx, top: ly,
            transform: 'translate(-50%, -50%)',
            fontFamily: 'var(--font-body)', fontSize: 10,
            letterSpacing: '0.08em',
            color: 'var(--text-dim)',
            pointerEvents: 'none', whiteSpace: 'nowrap', userSelect: 'none',
            textAlign: 'center', maxWidth: 110,
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {key}
            <span style={{ opacity: 0.45, marginLeft: 4 }}>{count}</span>
          </span>
        ))}

        {/* Thumbnails */}
        {allPlaced.map(({ artwork, bx, by }) => {
          const isHovered = hoveredId === artwork.id
          const cx = bx + THUMB / 2
          const cy = by + THUMB / 2

          let ox = 0, oy = 0
          if (mousePos) {
            const dx = cx - mousePos.x
            const dy = cy - mousePos.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < REPEL_R && dist > 0) {
              const force = Math.pow((REPEL_R - dist) / REPEL_R, 1.6) * MAX_PUSH
              ox = (dx / dist) * force
              oy = (dy / dist) * force
            }
          }

          return (
            <button
              key={artwork.id}
              title={artwork.title || 'Untitled'}
              onClick={() => onSelect(artwork)}
              onMouseEnter={() => setHoveredId(artwork.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                position: 'absolute',
                left: bx, top: by,
                width: THUMB, height: THUMB,
                padding: 0, border: 'none',
                borderRadius: 2, overflow: 'hidden',
                cursor: 'pointer',
                outline: isHovered ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.12)',
                outlineOffset: isHovered ? 2 : 0,
                zIndex: isHovered ? 20 : 1,
                transform: `translate(${ox}px, ${oy}px) scale(${isHovered ? 1.15 : 1})`,
                transition: mousePos
                  ? 'transform 0.1s ease-out, outline 0.15s'
                  : 'transform 0.4s ease-out, outline 0.15s',
                background: 'var(--card)',
                willChange: 'transform',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={artwork.imageData}
                alt={artwork.title || 'Artwork'}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </button>
          )
        })}
      </div>

      {/* Achromatic strip — colour mode only */}
      {mode === 'colour' && colourUnplaced.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 11,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--muted)', textAlign: 'center', marginBottom: 10,
          }}>
            Achromatic · greyscale · no palette
          </p>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
            maxWidth: BOARD,
          }}>
            {colourUnplaced.map(artwork => {
              const isHovered = hoveredId === artwork.id
              return (
                <button
                  key={artwork.id}
                  title={artwork.title || 'Untitled'}
                  onClick={() => onSelect(artwork)}
                  onMouseEnter={() => setHoveredId(artwork.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    width: THUMB, height: THUMB,
                    padding: 0, border: 'none',
                    borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
                    outline: isHovered ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                    outlineOffset: isHovered ? 2 : 0,
                    transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 0.18s, outline 0.18s',
                    background: 'var(--card)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={artwork.imageData}
                    alt={artwork.title || 'Artwork'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
