"use client"
import { useState } from 'react'
import { Artwork } from '@/lib/types'

// ── Colour math ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
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
  // Use the most saturated colour in the palette as the "dominant" for placement
  let best: { h: number; s: number; l: number } | null = null
  for (const hex of palette) {
    const rgb = hexToRgb(hex)
    if (!rgb) continue
    const hsl = rgbToHsl(...rgb)
    if (!best || hsl.s > best.s) best = hsl
  }
  return best
}

// ── Board geometry ────────────────────────────────────────────────────────────
const BOARD = 680        // px square
const THUMB = 72         // thumbnail size
const MAX_R = 280        // max radius from centre
const CX = BOARD / 2
const CY = BOARD / 2

function hslToPos(hsl: { h: number; s: number; l: number }): { x: number; y: number } {
  const angle = ((hsl.h - 90) / 360) * 2 * Math.PI   // rotate so 0° is top
  const r = hsl.s * MAX_R
  return {
    x: CX + r * Math.cos(angle) - THUMB / 2,
    y: CY + r * Math.sin(angle) - THUMB / 2,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  artworks: Artwork[]
  onSelect: (artwork: Artwork) => void
}

export default function ColourClusterView({ artworks, onSelect }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const placed: Array<{ artwork: Artwork; x: number; y: number }> = []
  const unplaced: Artwork[] = []

  for (const artwork of artworks) {
    const palette = artwork.aiAnalysis?.colorPalette
    if (!palette || palette.length === 0) { unplaced.push(artwork); continue }
    const hsl = dominantHsl(palette)
    if (!hsl || hsl.s < 0.05) { unplaced.push(artwork); continue } // near-grey goes to bottom strip
    const { x, y } = hslToPos(hsl)
    placed.push({ artwork, x, y })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      {/* Wheel */}
      <div style={{
        position: 'relative',
        width: BOARD, height: BOARD,
        borderRadius: '50%',
        border: '1px solid var(--border)',
        background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 70%)',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Faint axis lines */}
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.04)' }} />

        {placed.map(({ artwork, x, y }) => {
          const isHovered = hoveredId === artwork.id
          return (
            <button
              key={artwork.id}
              title={artwork.title || 'Untitled'}
              onClick={() => onSelect(artwork)}
              onMouseEnter={() => setHoveredId(artwork.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                position: 'absolute',
                left: x, top: y,
                width: THUMB, height: THUMB,
                padding: 0, border: 'none',
                borderRadius: 2,
                overflow: 'hidden',
                cursor: 'pointer',
                outline: isHovered ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                outlineOffset: isHovered ? 2 : 0,
                zIndex: isHovered ? 10 : 1,
                transform: isHovered ? 'scale(1.12)' : 'scale(1)',
                transition: 'transform 0.18s, outline 0.18s, z-index 0s',
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

      {/* Achromatic strip */}
      {unplaced.length > 0 && (
        <div>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 11,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--muted)', textAlign: 'center', marginBottom: 10,
          }}>
            Achromatic / no palette
          </p>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
            maxWidth: BOARD,
          }}>
            {unplaced.map(artwork => {
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
