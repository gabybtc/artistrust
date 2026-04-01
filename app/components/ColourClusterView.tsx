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

// ── Colour math (CIELAB) ──────────────────────────────────────────────────────
// Each artwork's palette is summarised as:
//   • a weighted Lab a*b* centroid  → drives 2-D placement on the scatter
//   • a 64-dimensional a*b* histogram → drives nearest-neighbour distance
// Using CIELAB instead of HSL gives perceptually-uniform distances and a much
// better spread across all four quadrants (red/green × yellow/blue).

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

// sRGB → linear light (IEC 61966-2-1)
function linearise(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

// Linear sRGB → CIE XYZ D65
function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const lr = linearise(r), lg = linearise(g), lb = linearise(b)
  return [
    lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375,
    lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750,
    lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041,
  ]
}

const D65 = [0.95047, 1.00000, 1.08883] as const

function labF(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116
}

// CIE XYZ → CIELAB
function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const fx = labF(x / D65[0]), fy = labF(y / D65[1]), fz = labF(z / D65[2])
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function hexToLab(hex: string): [number, number, number] | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  return xyzToLab(...rgbToXyz(...rgb))
}

// Chroma²-weighted centroid in Lab a*b* space.
// Weighting by C*² means vivid swatches dominate the position and near-neutral
// fillers contribute almost nothing — so a warm painting with a few grey tones
// still lands near warm, not near the centre.
// Returns maxChroma (the most vivid single swatch) for the achromatic gate.
function paletteCentroid(
  palette: string[],
): { L: number; a: number; b: number; chroma: number; maxChroma: number } | null {
  const labs: Array<{ L: number; a: number; b: number; c: number }> = []
  for (const hex of palette) {
    const lab = hexToLab(hex)
    if (!lab) continue
    labs.push({ L: lab[0], a: lab[1], b: lab[2], c: Math.sqrt(lab[1] ** 2 + lab[2] ** 2) })
  }
  if (labs.length === 0) return null

  const maxChroma = Math.max(...labs.map(l => l.c))
  const totalWeight = labs.reduce((s, l) => s + l.c * l.c, 0)

  let sL = 0, sA = 0, sB = 0
  if (totalWeight > 0) {
    for (const { L, a, b, c } of labs) {
      const w = (c * c) / totalWeight
      sL += w * L; sA += w * a; sB += w * b
    }
  } else {
    for (const { L, a, b } of labs) { sL += L; sA += a; sB += b }
    sL /= labs.length; sA /= labs.length; sB /= labs.length
  }

  return { L: sL, a: sA, b: sB, chroma: Math.sqrt(sA ** 2 + sB ** 2), maxChroma }
}

// 64-dimensional feature vector: 8×8 quantised histogram over Lab a*b* plane.
// Each axis is binned over [−100, 100]; the result is L2-normalised.
// Euclidean distance on these vectors is a perceptually-grounded colour
// similarity score and can be used for nearest-neighbour or clustering queries.
const N_BINS = 8
const LAB_AB_RANGE = 100

function paletteFeatureVector(palette: string[]): Float32Array {
  const vec = new Float32Array(N_BINS * N_BINS)
  let count = 0
  for (const hex of palette) {
    const lab = hexToLab(hex)
    if (!lab) continue
    const [, a, b] = lab
    const ai = Math.min(N_BINS - 1, Math.max(0,
      Math.floor((a + LAB_AB_RANGE) / (2 * LAB_AB_RANGE) * N_BINS)))
    const bi = Math.min(N_BINS - 1, Math.max(0,
      Math.floor((b + LAB_AB_RANGE) / (2 * LAB_AB_RANGE) * N_BINS)))
    vec[ai * N_BINS + bi]++
    count++
  }
  if (count > 0) {
    let norm = 0
    for (const v of vec) norm += v * v
    norm = Math.sqrt(norm)
    if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm
  }
  return vec
}

// L2 distance between two feature vectors — lower means more similar colour palette
export function vectorDistance(va: Float32Array, vb: Float32Array): number {
  let sum = 0
  for (let i = 0; i < va.length; i++) { const d = va[i] - vb[i]; sum += d * d }
  return Math.sqrt(sum)
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
const SPREAD_R = 140
const MAX_SPREAD = 56
const TIMELINE_PAD_X = 44   // horizontal inset before first/after last year mark
const TIMELINE_ROW_GAP = 46  // distance from centre line to first row of thumbnails

// Map Lab a*/b* to board x/y.
// a* → horizontal axis (positive = red-ish, negative = green-ish)
// b* → vertical axis, inverted for screen (positive = yellow = up, negative = blue = down)
const AB_SCALE = 78  // a*/b* magnitude that maps to MAX_R pixels from centre

function labToPos(a: number, b: number): { x: number; y: number } {
  return {
    x: CX + (a / AB_SCALE) * MAX_R - THUMB / 2,
    y: CY - (b / AB_SCALE) * MAX_R - THUMB / 2,
  }
}

// Compass labels for the a*b* diagram.
// (na, nb) are normalised unit-vector directions derived from real CIELAB
// coordinates of each colour family under D65.
const AB_LABELS: Array<{ label: string; na: number; nb: number; color: string }> = [
  { label: 'Yellow',  na: -0.17, nb:  0.99, color: 'hsl(55,  65%, 62%)' },
  { label: 'Red',     na:  0.77, nb:  0.64, color: 'hsl(5,   60%, 62%)' },
  { label: 'Magenta', na:  0.85, nb: -0.53, color: 'hsl(310, 55%, 65%)' },
  { label: 'Blue',    na:  0.28, nb: -0.96, color: 'hsl(220, 55%, 65%)' },
  { label: 'Cyan',    na: -0.95, nb: -0.32, color: 'hsl(185, 55%, 60%)' },
  { label: 'Green',   na: -0.68, nb:  0.73, color: 'hsl(115, 50%, 58%)' },
]


// ── Timeline layout for period mode ──────────────────────────────────────────

interface TimelineTick { label: string; tx: number; showLabel: boolean }
interface TimelineData {
  placed: Array<{ artwork: Artwork; bx: number; dy: number }>
  noDate: Artwork[]
  ticks: TimelineTick[]
  containerH: number
}

function timelineLayout(artworks: Artwork[]): TimelineData {
  const withYear: Array<{ artwork: Artwork; year: number }> = []
  const noDate: Artwork[] = []

  for (const a of artworks) {
    const y = parseInt(a.year ?? '', 10)
    if (isNaN(y) || y < 1400 || y > 2100) { noDate.push(a); continue }
    withYear.push({ artwork: a, year: y })
  }

  if (withYear.length === 0) return { placed: [], noDate, ticks: [], containerH: 160 }

  const rawYears = withYear.map(w => w.year)
  const rawMin = Math.min(...rawYears)
  const rawMax = Math.max(...rawYears)
  const range = rawMax - rawMin

  // Granularity: 1, 5 or 10 years depending on spread
  const bucketSize = range > 80 ? 10 : range > 30 ? 5 : 1
  const minBucket = Math.floor(rawMin / bucketSize) * bucketSize
  const maxBucket = Math.floor(rawMax / bucketSize) * bucketSize
  const bucketRange = Math.max(maxBucket - minBucket, 1)

  const groups = new Map<number, Artwork[]>()
  for (const { artwork, year } of withYear) {
    const bucket = Math.floor(year / bucketSize) * bucketSize
    if (!groups.has(bucket)) groups.set(bucket, [])
    groups.get(bucket)!.push(artwork)
  }

  const allBuckets: number[] = []
  for (let b = minBucket; b <= maxBucket; b += bucketSize) allBuckets.push(b)

  const usableW = BOARD - TIMELINE_PAD_X * 2 - THUMB
  const rowStep = THUMB + 8

  // Map a bucket year to an x pixel position; centre the single-bucket case
  const toX = (b: number) =>
    allBuckets.length === 1
      ? CX
      : TIMELINE_PAD_X + ((b - minBucket) / bucketRange) * usableW + THUMB / 2

  // dy = vertical offset from the centre line (negative = above, positive = below)
  const placed: Array<{ artwork: Artwork; bx: number; dy: number }> = []
  for (const [bucket, members] of groups) {
    const cx = toX(bucket)
    members.forEach((artwork, i) => {
      const jitter = idJitter(artwork.id, 8)
      const side = i % 2 === 0 ? -1 : 1
      const slot = Math.floor(i / 2)
      const oy = side * (TIMELINE_ROW_GAP + slot * rowStep)
      placed.push({
        artwork,
        bx: Math.max(4, Math.min(BOARD - THUMB - 4, cx - THUMB / 2 + jitter.dx)),
        dy: oy + jitter.dy,
      })
    })
  }

  // Compute the minimum container height that fits all thumbnails + tick labels
  const dyVals = placed.map(p => p.dy)
  const halfAbove = Math.max(TIMELINE_ROW_GAP + THUMB, -Math.min(...dyVals) + THUMB / 2 + 12)
  const halfBelow = Math.max(TIMELINE_ROW_GAP + THUMB, Math.max(...dyVals) + THUMB / 2 + 28)
  const containerH = Math.ceil(halfAbove + halfBelow)

  // Tick marks at every bucket; thin out text labels when there are many
  const labelInterval = Math.max(1, Math.ceil(allBuckets.length / 12))
  const ticks: TimelineTick[] = allBuckets.map((b, i) => ({
    label: String(b),
    tx: toX(b),
    showLabel: i % labelInterval === 0,
  }))

  return { placed, noDate, ticks, containerH }
}

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

// Returns true if a key looks like bad/misclassified data for its mode
function isSuspectKey(mode: ClusterMode, key: string): boolean {
  if (key === 'Unknown') return false
  switch (mode) {
    case 'period': {
      // Decade string should be e.g. "1980s". Decade must be 1400–2100.
      const m = key.match(/^(\d+)s$/)
      if (!m) return true
      const decade = parseInt(m[1], 10)
      return decade < 1400 || decade > 2100
    }
    case 'region':
      // A purely numeric string (e.g. a year) in a region field is wrong
      return /^\d+$/.test(key)
    default:
      return false
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
  const [infoHovered, setInfoHovered] = useState(false)
  const wheelRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = wheelRef.current?.getBoundingClientRect()
    if (!rect) return
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [])

  const handleMouseLeave = useCallback(() => setMousePos(null), [])

  const { colourPlaced, colourUnplaced } = useMemo(() => {
    const placed: Array<{ artwork: Artwork; bx: number; by: number; featureVec: Float32Array }> = []
    const unplaced: Artwork[] = []
    for (const artwork of artworks) {
      const palette = artwork.aiAnalysis?.colorPalette
      if (!palette || palette.length === 0) { unplaced.push(artwork); continue }
      const centroid = paletteCentroid(palette)
      // Gate on the most vivid individual swatch, not the centroid.
      // This keeps complementary-palette works (e.g. red + cyan) on the wheel
      // even when their average cancels to near-neutral.
      if (!centroid || centroid.maxChroma < 14) { unplaced.push(artwork); continue }
      const featureVec = paletteFeatureVector(palette)
      const jitter = idJitter(artwork.id, 20)
      const { x, y } = labToPos(centroid.a, centroid.b)
      placed.push({
        artwork,
        featureVec,
        bx: Math.max(4, Math.min(BOARD - THUMB - 4, x + jitter.dx)),
        by: Math.max(4, Math.min(BOARD - THUMB - 4, y + jitter.dy)),
      })
    }
    return { colourPlaced: placed, colourUnplaced: unplaced }
  }, [artworks])

  const spokePlaced = useMemo(() =>
    mode !== 'colour' && mode !== 'period' ? spokeLayout(artworks, a => keyForMode(mode, a)) : []
  , [artworks, mode])

  const spokeLabelsData = useMemo(() =>
    mode !== 'colour' && mode !== 'period' ? spokeLabels(artworks, a => keyForMode(mode, a)) : []
  , [artworks, mode])

  const timelinePlacedData = useMemo((): TimelineData =>
    mode === 'period' ? timelineLayout(artworks) : { placed: [], noDate: [], ticks: [], containerH: 0 }
  , [artworks, mode])

  const allPlaced = mode === 'colour' ? colourPlaced
    : mode === 'period' ? timelinePlacedData.placed.map(({ artwork, bx, dy }) => ({
        artwork, bx,
        by: timelinePlacedData.containerH / 2 - THUMB / 2 + dy,
      }))
    : spokePlaced

  const nearestId = useMemo(() => {
    if (!mousePos) return null
    let best: string | null = null
    let bestDist = Infinity
    for (const { artwork, bx, by } of allPlaced) {
      const dx = (bx + THUMB / 2) - mousePos.x
      const dy = (by + THUMB / 2) - mousePos.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < bestDist) { bestDist = d; best = artwork.id }
    }
    return bestDist < 180 ? best : null
  }, [mousePos, allPlaced])

  const nearestPlaced = nearestId ? allPlaced.find(p => p.artwork.id === nearestId) ?? null : null

  const hoveredArtwork = allPlaced.find(p => p.artwork.id === nearestId)?.artwork
    ?? (mode === 'colour' ? colourUnplaced.find(a => a.id === hoveredId) : undefined)

  const subtitles: Record<ClusterMode, string> = {
    colour:  'Works arranged by their dominant colour',
    period:  'Works arranged chronologically',
    medium:  'Works grouped by material or medium',
    style:   'Works grouped by artistic style',
    region:  'Works grouped by place or region',
  }

  const tooltips: Record<ClusterMode, string> = {
    colour:  'Each work is placed by its main colour. The direction shows the colour family — red, yellow, green, blue, and so on. The further from the centre, the more vivid or saturated the piece. Grey, near-white, and colourless works appear in the strip below.',
    period:  'Each spoke represents a decade. Works radiate outward from the center along their spoke.',
    medium:  'Each spoke is a distinct medium (oil, watercolor, etc.). The most-used media are at the top.',
    style:   'Each spoke is an artistic style as identified by AI analysis.',
    region:  'Each spoke is a place or region. The most-visited locations are at the top.',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, position: 'relative' }}>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 11,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'var(--muted)', margin: 0,
        }}>
          {subtitles[mode]}
        </p>
        <span
          onMouseEnter={() => setInfoHovered(true)}
          onMouseLeave={() => setInfoHovered(false)}
          style={{
            width: 15, height: 15, borderRadius: '50%',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-body)', fontSize: 9,
            color: 'var(--text-dim)', cursor: 'default',
            flexShrink: 0, userSelect: 'none',
          }}
        >
          i
        </span>
        {infoHovered && (
          <div style={{
            position: 'absolute', top: 22, left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '8px 12px',
            fontFamily: 'var(--font-body)', fontSize: 11,
            color: 'var(--text-dim)', lineHeight: 1.6,
            whiteSpace: 'nowrap', zIndex: 100,
            pointerEvents: 'none',
          }}>
            {tooltips[mode]}
          </div>
        )}
      </div>

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
          width: BOARD,
          height: mode === 'period' ? timelinePlacedData.containerH : BOARD,
          borderRadius: mode === 'colour' ? '50%' : 12,
          border: mode === 'period' ? 'none' : '1px solid var(--border)',
          background: mode === 'period' ? 'transparent' : 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.025) 0%, transparent 70%)',
          flexShrink: 0,
          cursor: 'crosshair',
          transition: 'border-radius 0.3s',
        }}
      >
        {/* Axis lines — hidden in period mode which draws its own timeline */}
        {mode !== 'period' && <>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        </>}

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
            {AB_LABELS.map(({ label, na, nb, color }) => {
              const r = MAX_R + 26
              return (
                <span key={label} style={{
                  position: 'absolute',
                  left: CX + r * na,
                  top: CY - r * nb,
                  transform: 'translate(-50%, -50%)',
                  fontFamily: 'var(--font-body)', fontSize: 10,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color,
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
              Neutral
            </span>
          </>
        )}

        {/* Timeline decorations — period mode only */}
        {mode === 'period' && (
          <>
            {/* Centre / baseline */}
            <div style={{
              position: 'absolute', top: timelinePlacedData.containerH / 2,
              left: TIMELINE_PAD_X, right: TIMELINE_PAD_X,
              height: 1, background: 'rgba(255,255,255,0.18)',
              pointerEvents: 'none',
            }} />
            {/* Tick marks at each bucket */}
            {timelinePlacedData.ticks.map(({ label, tx }) => (
              <div key={`tick-${label}`} style={{
                position: 'absolute',
                left: tx, top: timelinePlacedData.containerH / 2 - 5,
                width: 1, height: 10,
                background: 'rgba(255,255,255,0.35)',
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
              }} />
            ))}
            {/* Year labels — just below the centre line */}
            {timelinePlacedData.ticks.filter(t => t.showLabel).map(({ label, tx }) => (
              <span key={`lbl-${label}`} style={{
                position: 'absolute', left: tx,
                top: timelinePlacedData.containerH / 2 + 10,
                transform: 'translateX(-50%)',
                fontFamily: 'var(--font-body)', fontSize: 10,
                letterSpacing: '0.06em', color: 'var(--text-dim)',
                pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
                zIndex: 2,
              }}>
                {label}
              </span>
            ))}
          </>
        )}

        {/* Spoke-mode labels */}
        {mode !== 'colour' && mode !== 'period' && spokeLabelsData.map(({ key, count, lx, ly }) => {
          const suspect = isSuspectKey(mode, key)
          return (
            <span key={key} style={{
              position: 'absolute',
              left: lx, top: ly,
              transform: 'translate(-50%, -50%)',
              fontFamily: 'var(--font-body)', fontSize: 10,
              letterSpacing: '0.08em',
              color: suspect ? 'rgba(220,160,60,0.9)' : 'var(--text-dim)',
              pointerEvents: 'none', whiteSpace: 'nowrap', userSelect: 'none',
              textAlign: 'center', maxWidth: 110,
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {suspect && <span style={{ marginRight: 3, opacity: 0.8 }}>⚠</span>}
              {key}
              <span style={{ opacity: 0.45, marginLeft: 4 }}>{count}</span>
            </span>
          )
        })}

        {/* Thumbnails */}
        {allPlaced.map(({ artwork, bx, by }) => {
          const isNearest = artwork.id === nearestId

          let ox = 0, oy = 0
          if (nearestPlaced && !isNearest) {
            const ndx = (bx + THUMB / 2) - (nearestPlaced.bx + THUMB / 2)
            const ndy = (by + THUMB / 2) - (nearestPlaced.by + THUMB / 2)
            const ndist = Math.sqrt(ndx * ndx + ndy * ndy)
            if (ndist < SPREAD_R && ndist > 0) {
              const force = Math.pow((SPREAD_R - ndist) / SPREAD_R, 1.5) * MAX_SPREAD
              ox = (ndx / ndist) * force
              oy = (ndy / ndist) * force
            }
          }

          return (
            <button
              key={artwork.id}
              title={artwork.title || 'Untitled'}
              onClick={() => onSelect(artwork)}
              style={{
                position: 'absolute',
                left: bx, top: by,
                width: THUMB, height: THUMB,
                padding: 0, border: 'none',
                borderRadius: 2, overflow: 'hidden',
                cursor: 'pointer',
                outline: isNearest ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.12)',
                outlineOffset: isNearest ? 2 : 0,
                zIndex: isNearest ? 20 : 1,
                transform: `translate(${ox}px, ${oy}px) scale(${isNearest ? 1.2 : 1})`,
                transition: mousePos
                  ? 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), outline 0.2s'
                  : 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), outline 0.2s',
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

      {/* No-date strip — period mode only */}
      {mode === 'period' && timelinePlacedData.noDate.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 11,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--muted)', textAlign: 'center', marginBottom: 10,
          }}>
            No date recorded
          </p>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center',
            maxWidth: BOARD,
          }}>
            {timelinePlacedData.noDate.map(artwork => {
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

      {/* Achromatic strip — colour mode only */}
      {mode === 'colour' && colourUnplaced.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 11,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'var(--muted)', textAlign: 'center', marginBottom: 10,
          }}>
            Achromatic · grayscale · no palette
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
