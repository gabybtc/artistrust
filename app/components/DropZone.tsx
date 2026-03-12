'use client'

import { useCallback, useRef, useState } from 'react'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  label?: string
}

function isAcceptedImage(f: File): boolean {
  return f.type.startsWith('image/') || /\.tiff?$/i.test(f.name)
}

async function collectFromEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise(resolve => {
      (entry as FileSystemFileEntry).file(
        f => resolve(isAcceptedImage(f) ? [f] : []),
        () => resolve([])
      )
    })
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    const allEntries: FileSystemEntry[] = []
    await new Promise<void>(resolve => {
      const readBatch = () => {
        reader.readEntries(batch => {
          if (batch.length === 0) { resolve(); return }
          allEntries.push(...batch)
          readBatch()
        }, () => resolve())
      }
      readBatch()
    })
    const nested = await Promise.all(allEntries.map(collectFromEntry))
    return nested.flat()
  }
  return []
}

export default function DropZone({ onFiles, label = 'Drag paintings here' }: DropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleFileList = useCallback((files: FileList | null) => {
    if (!files) return
    const images = Array.from(files).filter(isAcceptedImage)
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

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const items = Array.from(e.dataTransfer.items)
    const hasEntries = items.length > 0 && typeof items[0].webkitGetAsEntry === 'function'
    if (hasEntries) {
      const entries = items
        .map(i => i.webkitGetAsEntry())
        .filter(Boolean) as FileSystemEntry[]
      const nested = await Promise.all(entries.map(collectFromEntry))
      const images = nested.flat()
      if (images.length) onFiles(images)
    } else {
      handleFileList(e.dataTransfer.files)
    }
  }, [onFiles, handleFileList])

  const accent = 'var(--accent)'          // #c9a96e — your existing gold
  const accentDim = 'var(--accent-dim)'   // softer gold for inactive state

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        position: 'relative',
        borderRadius: 4,
        padding: '28px 40px 24px',
        textAlign: 'center',
        background: dragging
          ? 'rgba(201,169,110,0.05)'
          : 'linear-gradient(160deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)',
        border: `1px solid ${dragging ? 'var(--accent)' : 'var(--border)'}`,
        boxShadow: dragging
          ? '0 0 0 1px var(--accent), inset 0 0 40px rgba(201,169,110,0.04)'
          : 'inset 0 1px 0 rgba(255,255,255,0.04)',
        transition: 'all 0.22s ease',
        userSelect: 'none',
        cursor: 'default',
      }}
    >
      {/* Corner marks — subtle, use accent color */}
      {(['tl','tr','bl','br'] as const).map(pos => (
        <span key={pos} style={{
          position: 'absolute',
          width: 8, height: 8,
          top:    pos.startsWith('t') ? 8 : undefined,
          bottom: pos.startsWith('b') ? 8 : undefined,
          left:   pos.endsWith('l')   ? 8 : undefined,
          right:  pos.endsWith('r')   ? 8 : undefined,
          borderTop:    pos.startsWith('t') ? `1px solid ${accent}` : undefined,
          borderBottom: pos.startsWith('b') ? `1px solid ${accent}` : undefined,
          borderLeft:   pos.endsWith('l')   ? `1px solid ${accent}` : undefined,
          borderRight:  pos.endsWith('r')   ? `1px solid ${accent}` : undefined,
          opacity: dragging ? 0.9 : 0.3,
          transition: 'opacity 0.22s',
          pointerEvents: 'none',
        }} />
      ))}

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.tif,.tiff"
        multiple
        style={{ display: 'none' }}
        onChange={e => { handleFileList(e.target.files); e.target.value = '' }}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error — webkitdirectory is non-standard but all modern browsers support it
        webkitdirectory="true"
        multiple
        style={{ display: 'none' }}
        onChange={e => { handleFileList(e.target.files); e.target.value = '' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 24, justifyContent: 'center' }}>

        {/* Upload icon */}
        <div style={{
          flexShrink: 0,
          width: 44, height: 44,
          borderRadius: '50%',
          border: `1px solid ${dragging ? accent : 'var(--border)'}`,
          background: dragging ? 'rgba(201,169,110,0.08)' : 'rgba(255,255,255,0.03)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.22s',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            style={{ opacity: dragging ? 1 : 0.5, transition: 'opacity 0.22s' }}
          >
            <path d="M12 16V8M12 8l-3 3M12 8l3 3" stroke={dragging ? 'var(--accent)' : 'var(--text)'}
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4"
              stroke={dragging ? 'var(--accent)' : 'var(--text)'}
              strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Text block */}
        <div style={{ textAlign: 'left' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 17, fontStyle: 'italic', fontWeight: 400,
            color: dragging ? accent : 'var(--text)',
            margin: 0, lineHeight: 1.3,
            transition: 'color 0.22s',
          }}>
            {dragging ? 'Release to add works' : label}
          </h2>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--text-dim)', margin: '4px 0 0',
          }}>
            Drop images or entire folders · JPG · PNG · WEBP · TIFF · No limit
          </p>

          {/* Browse buttons */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <button
              onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
              style={browseBtn(false)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
            >
              Browse files
            </button>
            <button
              onClick={e => { e.stopPropagation(); folderInputRef.current?.click() }}
              style={browseBtn(true)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = accentDim; e.currentTarget.style.color = 'var(--text)' }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ marginRight: 4, verticalAlign: 'middle', marginTop: -1 }}>
                <path d="M2 4.5A1.5 1.5 0 013.5 3h3.086a1.5 1.5 0 011.06.44l.915.914A1.5 1.5 0 009.621 5H12.5A1.5 1.5 0 0114 6.5v6A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-8z"
                  stroke="currentColor" strokeWidth="1.1" fill="none"/>
              </svg>
              Browse folder
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

function browseBtn(isFolder: boolean): React.CSSProperties {
  return {
    fontFamily: 'var(--font-body)',
    fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: isFolder ? 'var(--text)' : 'var(--text-dim)',
    background: isFolder ? 'rgba(201,169,110,0.07)' : 'transparent',
    border: `1px solid ${isFolder ? 'var(--accent-dim)' : 'var(--border)'}`,
    borderRadius: 2,
    padding: '5px 12px',
    cursor: 'pointer',
    transition: 'border-color 0.18s, color 0.18s',
    display: 'inline-flex',
    alignItems: 'center',
  }
}
