'use client'

/**
 * UploadDefaultsBar — lets the artist set sticky field defaults that are
 * applied to every newly queued artwork. Sits above the DropZone.
 *
 * Collapsed: shows active defaults as clearable chips.
 * Expanded:  shows a SmartInput row for each supported field.
 */

import { useState, useEffect } from 'react'
import type { UploadDefaults } from '@/lib/types'
import type { ArtworkSuggestions } from './ArtworkModal'
import SmartInput from './SmartInput'


interface UploadDefaultsBarProps {
  defaults: UploadDefaults
  suggestions: ArtworkSuggestions
  onSet: (field: keyof UploadDefaults, value: string) => void
  onClear: (field: keyof UploadDefaults) => void
}

const FIELDS: Array<{ key: keyof UploadDefaults; label: string; placeholder: string }> = [
  { key: 'copyrightHolder', label: 'Artist / © Holder', placeholder: 'Your full legal name' },
  { key: 'location',        label: 'Location',           placeholder: 'e.g. Studio storage, Bank vault' },
  { key: 'material',        label: 'Material',           placeholder: 'e.g. Oil on linen, 35mm Film' },
  { key: 'place',           label: 'Place',              placeholder: 'e.g. Paris, New York' },
  { key: 'year',            label: 'Year',               placeholder: 'e.g. 2024' },
  { key: 'series',          label: 'Series',             placeholder: 'e.g. Coastline Studies' },
]

const SUGGESTION_MAP: Record<keyof UploadDefaults, keyof ArtworkSuggestions> = {
  copyrightHolder: 'places', // no dedicated list; reuse empty fallback
  location:        'locations',
  material:        'materials',
  place:           'places',
  year:            'years',
  series:          'series',
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
  marginBottom: 5,
  display: 'block',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 2,
  padding: '7px 10px',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font-body)',
  fontWeight: 300,
  outline: 'none',
  transition: 'border-color 0.2s',
}

export default function UploadDefaultsBar({
  defaults,
  suggestions,
  onSet,
  onClear,
}: UploadDefaultsBarProps) {
  const activeFields = FIELDS.filter(f => !!defaults[f.key])
  const hasAny = activeFields.length > 0

  // Auto-expand on first visit (no defaults set yet) as an onboarding nudge.
  // Once the user collapses it, we remember their preference in session state.
  const [expanded, setExpanded] = useState(false)
  const [userToggled, setUserToggled] = useState(false)

  useEffect(() => {
    if (!userToggled && !hasAny) {
      setExpanded(true)
    }
  }, [hasAny, userToggled])

  const handleChange = (key: keyof UploadDefaults, val: string) => {
    if (val.trim()) {
      onSet(key, val)
    } else {
      onClear(key)
    }
  }

  const toggle = () => {
    setExpanded(e => !e)
    setUserToggled(true)
  }

  return (
    <div style={{
      marginBottom: 16,
      border: '1px solid var(--border)',
      borderRadius: 2,
      background: 'var(--surface)',
      transition: 'border-color 0.2s',
    }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 14px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={toggle}
      >
        {/* Label */}
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          flexShrink: 0,
        }}>
          Upload defaults
        </span>

        {/* Active chips (collapsed view) */}
        {!expanded && (
          <div
            style={{ display: 'flex', gap: 5, flex: 1, flexWrap: 'wrap' }}
            onClick={e => e.stopPropagation()}
          >
            {activeFields.length === 0 && (
              <span style={{
                fontSize: 11,
                color: 'var(--muted)',
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.04em',
                fontStyle: 'italic',
              }}>
                None set — click to configure
              </span>
            )}
            {activeFields.map(f => (
              <span
                key={f.key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px 2px 9px',
                  background: 'rgba(201,169,110,0.1)',
                  border: '1px solid var(--accent-dim)',
                  borderRadius: 100,
                  fontSize: 11,
                  color: 'var(--accent)',
                  fontFamily: 'var(--font-body)',
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ color: 'var(--text-dim)', marginRight: 1 }}>{f.label}:</span>
                {defaults[f.key]}
                <button
                  onClick={() => onClear(f.key)}
                  title={`Clear ${f.label} default`}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0 0 0 3px',
                    cursor: 'pointer',
                    color: 'var(--accent-dim)',
                    fontSize: 13,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--accent-dim)')}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {expanded && <div style={{ flex: 1 }} />}

        {/* Chevron toggle */}
        <svg
          width="11" height="7" viewBox="0 0 11 7" fill="none"
          style={{
            flexShrink: 0,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            color: 'var(--text-dim)',
          }}
        >
          <path d="M1 1l4.5 4.5L10 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Expanded fields */}
      {expanded && (
        <div style={{
          padding: '4px 14px 14px',
          borderTop: '1px solid var(--border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '12px 14px',
        }}>
          <p style={{
            gridColumn: '1 / -1',
            fontSize: 11,
            color: 'var(--muted)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.04em',
            marginTop: 10,
            marginBottom: 2,
          }}>
            These values will be pre-filled on every new upload. Leave a field blank to skip it.
          </p>

          {FIELDS.map(f => {
            const suggKey = SUGGESTION_MAP[f.key]
            const opts = (suggKey === 'places' && f.key === 'copyrightHolder')
              ? [] // no separate artists list
              : (suggestions[suggKey] as string[] ?? [])
            return (
              <div key={f.key}>
                <label style={labelStyle}>{f.label}</label>
                <SmartInput
                  value={defaults[f.key] ?? ''}
                  onChange={val => handleChange(f.key, val)}
                  suggestions={opts}
                  placeholder={f.placeholder}
                  inputStyle={inputStyle}
                />
              </div>
            )
          })}

          {/* Clear all */}
          {hasAny && (
            <div style={{
              gridColumn: '1 / -1',
              display: 'flex',
              justifyContent: 'flex-end',
              paddingTop: 4,
            }}>
              <button
                onClick={() => FIELDS.forEach(f => onClear(f.key))}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 2,
                  padding: '4px 12px',
                  color: 'var(--text-dim)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.18s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--muted)'
                  e.currentTarget.style.color = 'var(--text)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-dim)'
                }}
              >
                Clear all defaults
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
