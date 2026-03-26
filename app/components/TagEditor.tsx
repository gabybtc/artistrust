"use client"
import { useState, useRef, useEffect } from 'react'

// ── Namespace colour map ─────────────────────────────────────────────────────
const NS_COLOURS: Record<string, string> = {
  medium:   'var(--accent)',        // gold
  subject:  '#7eb8ff',              // blue
  content:  '#aaaaaa',              // neutral
  mood:     '#c9a896',              // mauve
  style:    '#8ecfb0',              // sage
  colour:   '#b8a9ff',              // lavender
  camera:   'var(--text-dim)',      // muted
  lens:     'var(--text-dim)',
  aperture: 'var(--text-dim)',
}

function nsColour(tag: string): string {
  const ns = tag.split(':')[0]
  return NS_COLOURS[ns] ?? '#aaaaaa'
}

function nsLabel(tag: string): string {
  const idx = tag.indexOf(':')
  if (idx < 0) return tag
  const ns = tag.slice(0, idx)
  const val = tag.slice(idx + 1)
  return `${ns} · ${val}`
}

interface TagEditorProps {
  tags: string[]
  allTags: string[]           // suggestion pool (all tags from catalogue)
  onChange: (tags: string[]) => void
}

export default function TagEditor({ tags, allTags, onChange }: TagEditorProps) {
  const [inputVal, setInputVal] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLUListElement>(null)
  const [activeIdx, setActiveIdx] = useState(-1)

  const filtered = (
    inputVal.trim()
      ? allTags.filter(t =>
          !tags.includes(t) &&
          t.toLowerCase().includes(inputVal.toLowerCase())
        )
      : allTags.filter(t => !tags.includes(t))
  ).slice(0, 20)

  useEffect(() => { setActiveIdx(-1) }, [inputVal])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        !inputRef.current?.closest('div')?.contains(target) &&
        !listRef.current?.contains(target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const addTag = (tag: string) => {
    const clean = tag.trim()
    if (!clean || tags.includes(clean)) { setInputVal(''); setOpen(false); return }
    onChange([...tags, clean])
    setInputVal('')
    setOpen(false)
    inputRef.current?.focus()
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && filtered[activeIdx]) {
        addTag(filtered[activeIdx])
      } else if (inputVal.trim()) {
        addTag(inputVal.trim())
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIdx(-1)
    } else if (e.key === 'Backspace' && !inputVal && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  // Group tags by namespace prefix for display
  const grouped: Record<string, string[]> = {}
  for (const tag of tags) {
    const ns = tag.split(':')[0]
    ;(grouped[ns] = grouped[ns] ?? []).push(tag)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Chips grouped by namespace */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {tags.map(tag => {
            const colour = nsColour(tag)
            return (
              <span
                key={tag}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px',
                  background: `color-mix(in srgb, ${colour} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${colour} 30%, transparent)`,
                  borderRadius: 2,
                  fontSize: 11, fontFamily: 'var(--font-body)',
                  color: colour,
                  letterSpacing: '0.04em',
                }}
              >
                {nsLabel(tag)}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: colour, opacity: 0.6,
                    padding: '0 0 0 2px', fontSize: 13, lineHeight: 1,
                    display: 'flex', alignItems: 'center',
                  }}
                  aria-label={`Remove ${tag}`}
                >×</button>
              </span>
            )
          })}
        </div>
      )}

      {/* Input + dropdown */}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={e => { setInputVal(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? 'Add a tag…' : 'Add another tag…'}
          style={{
            width: '100%',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 2,
            padding: '7px 12px',
            color: 'var(--text)',
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            fontWeight: 300,
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocusCapture={e => (e.target.style.borderColor = 'var(--accent-dim)')}
          onBlur={e => (e.target.style.borderColor = 'var(--border)')}
        />

        {open && filtered.length > 0 && (
          <ul
            ref={listRef}
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 120,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderTop: 'none',
              borderRadius: '0 0 2px 2px',
              margin: 0, padding: '4px 0',
              listStyle: 'none',
              maxHeight: 220, overflowY: 'auto',
            }}
          >
            {filtered.map((tag, i) => {
              const colour = nsColour(tag)
              return (
                <li
                  key={tag}
                  onMouseDown={e => { e.preventDefault(); addTag(tag) }}
                  onMouseEnter={() => setActiveIdx(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    background: i === activeIdx ? 'rgba(255,255,255,0.04)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: colour,
                  }} />
                  <span style={{
                    fontFamily: 'var(--font-body)', fontSize: 12,
                    color: 'var(--text)',
                    letterSpacing: '0.03em',
                  }}>
                    {nsLabel(tag)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
