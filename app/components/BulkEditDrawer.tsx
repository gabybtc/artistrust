'use client'

import { useState } from 'react'
import type { Artwork } from '@/lib/types'
import type { ArtworkSuggestions } from './ArtworkModal'
import SmartInput from './SmartInput'

interface BulkEditDrawerProps {
  selectedArtworks: Artwork[]
  suggestions: ArtworkSuggestions
  onApply: (patch: Partial<Artwork>) => void
  onClose: () => void
}

const EMPTY: Record<string, string> = {
  year: '', place: '', location: '', material: '', series: '',
  copyrightHolder: '', copyrightYear: '',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-body)',
  fontSize: 11,
  letterSpacing: '0.13em',
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
  marginBottom: 5,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 3,
  padding: '7px 10px',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'inherit',
  fontWeight: 300,
  outline: 'none',
}

export default function BulkEditDrawer({ selectedArtworks, suggestions, onApply, onClose }: BulkEditDrawerProps) {
  const [fields, setFields] = useState<Record<string, string>>({ ...EMPTY })
  const count = selectedArtworks.length

  const set = (key: string, val: string) => setFields(f => ({ ...f, [key]: val }))

  const handleApply = () => {
    // Only pass fields the artist actually filled in
    const patch: Partial<Artwork> = {}
    if (fields.year)            patch.year            = fields.year
    if (fields.place)           patch.place           = fields.place
    if (fields.location)        patch.location        = fields.location
    if (fields.material)        patch.material        = fields.material
    if (fields.series)          patch.series          = fields.series
    if (fields.copyrightHolder) patch.copyrightHolder = fields.copyrightHolder
    if (fields.copyrightYear)   patch.copyrightYear   = fields.copyrightYear
    if (!Object.keys(patch).length) return
    onApply(patch)
  }

  const hasChanges = Object.values(fields).some(v => v !== '')

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 60,
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.55)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '13px 24px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 11,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--accent)',
          }}>
            Editing {count} work{count !== 1 ? 's' : ''}
          </span>
          <span style={{
            fontFamily: 'var(--font-body)', fontSize: 11,
            color: 'var(--muted)', letterSpacing: '0.04em',
          }}>
            · Fill only the fields you want to apply to all selected works
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 2, width: 26, height: 26,
            cursor: 'pointer',
            color: 'var(--text-dim)', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'border-color 0.18s, color 0.18s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-dim)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
        >
          ×
        </button>
      </div>

      {/* Fields grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 14,
        padding: '18px 24px',
        maxHeight: 260,
        overflowY: 'auto',
      }}>
        <div>
          <label style={labelStyle}>Year</label>
          <SmartInput value={fields.year} onChange={v => set('year', v)} suggestions={suggestions.years} placeholder="e.g. 2019" inputStyle={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Place</label>
          <SmartInput value={fields.place} onChange={v => set('place', v)} suggestions={suggestions.places} placeholder="e.g. Paris" inputStyle={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Location</label>
          <SmartInput value={fields.location} onChange={v => set('location', v)} suggestions={suggestions.locations} placeholder="e.g. Studio storage" inputStyle={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Material</label>
          <SmartInput value={fields.material} onChange={v => set('material', v)} suggestions={suggestions.materials} placeholder="e.g. Oil on canvas" inputStyle={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Series</label>
          <SmartInput value={fields.series} onChange={v => set('series', v)} suggestions={suggestions.series} placeholder="e.g. Coastline Studies" inputStyle={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>© Holder</label>
          <SmartInput value={fields.copyrightHolder} onChange={v => set('copyrightHolder', v)} suggestions={[]} placeholder="Your full legal name" inputStyle={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>© Year</label>
          <SmartInput value={fields.copyrightYear} onChange={v => set('copyrightYear', v)} suggestions={suggestions.years} placeholder={new Date().getFullYear().toString()} inputStyle={inputStyle} />
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
        padding: '12px 24px',
        borderTop: '1px solid var(--border)',
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid var(--border)', borderRadius: 2,
            padding: '7px 18px',
            color: 'var(--text-dim)',
            fontFamily: 'var(--font-body)', fontSize: 11,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'border-color 0.18s, color 0.18s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-dim)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={!hasChanges}
          style={{
            background: hasChanges ? 'var(--accent)' : 'var(--border)',
            border: 'none', borderRadius: 2,
            padding: '7px 20px',
            color: hasChanges ? '#0a0a0a' : 'var(--muted)',
            fontFamily: 'var(--font-body)', fontSize: 11,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            fontWeight: 500,
            cursor: hasChanges ? 'pointer' : 'default',
            transition: 'background 0.18s, color 0.18s',
          }}
        >
          Apply to {count} work{count !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  )
}
