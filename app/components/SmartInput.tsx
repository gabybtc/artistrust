'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface SmartInputProps {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  inputStyle?: React.CSSProperties
  /** If true, renders a larger italic display input (matches the title field style) */
  displayVariant?: boolean
}

export default function SmartInput({
  value,
  onChange,
  suggestions,
  placeholder,
  style,
  inputStyle,
  displayVariant = false,
}: SmartInputProps) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter suggestions: match anywhere in the string, case-insensitive, exclude exact match
  const filtered = value
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s !== value)
    : suggestions.filter(s => s !== value)

  const shouldShow = open && filtered.length > 0

  const commit = useCallback((val: string) => {
    onChange(val)
    setOpen(false)
    setHighlighted(-1)
  }, [onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!shouldShow) {
      if (e.key === 'ArrowDown' && filtered.length > 0) {
        setOpen(true)
        setHighlighted(0)
        e.preventDefault()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      setHighlighted(h => (h + 1) % filtered.length)
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      setHighlighted(h => (h <= 0 ? filtered.length - 1 : h - 1))
      e.preventDefault()
    } else if (e.key === 'Enter' && highlighted >= 0) {
      commit(filtered[highlighted])
      e.preventDefault()
    } else if (e.key === 'Escape') {
      setOpen(false)
      setHighlighted(-1)
    }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setHighlighted(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Reset highlight when filtered list changes
  useEffect(() => { setHighlighted(-1) }, [value])

  const baseInputStyle: React.CSSProperties = displayVariant
    ? {
        width: '100%',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        color: 'var(--text)',
        fontFamily: 'var(--font-display), Georgia, serif',
        fontStyle: 'italic',
        fontSize: 20,
        padding: '6px 0',
        outline: 'none',
      }
    : {
        width: '100%',
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 3,
        color: 'var(--text)',
        fontSize: 13,
        padding: '7px 10px',
        outline: 'none',
        fontFamily: 'inherit',
        fontWeight: 300,
      }

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        style={{ ...baseInputStyle, ...inputStyle }}
        autoComplete="off"
      />
      {shouldShow && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: 0,
            right: 0,
            zIndex: 200,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            listStyle: 'none',
            margin: 0,
            padding: '4px 0',
            maxHeight: 200,
            overflowY: 'auto',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          {filtered.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === highlighted}
              onMouseDown={() => commit(s)}
              onMouseEnter={() => setHighlighted(i)}
              style={{
                padding: '7px 12px',
                fontSize: 13,
                fontWeight: 300,
                cursor: 'pointer',
                color: i === highlighted ? 'var(--accent)' : 'var(--text)',
                background: i === highlighted ? 'rgba(201,169,110,0.07)' : 'transparent',
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
