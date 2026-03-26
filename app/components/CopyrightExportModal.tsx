"use client"
import { useState, useMemo, useCallback, useEffect } from 'react'
import type { Artwork } from '@/lib/types'
import type { Plan } from '@/lib/plans'
import { canExportCopyright } from '@/lib/plans'
import { generatePhotographsPackage } from '@/lib/copyrightPackage'

const GROUP_SIZE_PHOTO = 750
const GROUP_SIZE_2D = 20

interface Props {
  artworks: Artwork[]
  initialSelected: Set<string>
  artistName: string
  onClose: () => void
  plan?: Plan
  onUpgradeClick?: () => void
}

type Tab = 'photographs' | '2d-visual-art'

export default function CopyrightExportModal({ artworks, initialSelected, artistName, onClose, plan = 'preserve', onUpgradeClick }: Props) {
  const allowed = canExportCopyright(plan)
  if (!allowed) {
    return (
      <div
        role="dialog" aria-modal="true"
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.72)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}
      >
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 4, padding: '44px 48px', maxWidth: 400, textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, marginBottom: 16 }}>©</div>
          <h3 style={{
            fontFamily: 'var(--font-display)', fontSize: 20,
            fontWeight: 400, fontStyle: 'italic', color: 'var(--text)', marginBottom: 12,
          }}>Studio plan required</h3>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-body)', lineHeight: 1.6, marginBottom: 28 }}>
            Copyright export packages are available on the Studio and Archive plans.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => { onClose(); onUpgradeClick?.() }}
              style={{
                background: 'var(--accent)', border: 'none', borderRadius: 2,
                padding: '9px 24px', fontFamily: 'var(--font-body)',
                fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#0a0a0a', cursor: 'pointer',
              }}
            >
              View plans
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: '1px solid var(--border)', borderRadius: 2,
                padding: '9px 24px', fontFamily: 'var(--font-body)',
                fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--text-dim)', cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }
  const [activeTab, setActiveTab] = useState<Tab>('photographs')
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set(initialSelected))
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [copiedGroup, setCopiedGroup] = useState<number | null>(null)

  // Reset selection whenever the modal re-opens with new initialSelected
  useEffect(() => {
    setCheckedIds(new Set(initialSelected))
  }, [initialSelected])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }, [])

  const selectedArtworks = useMemo(
    () => artworks.filter(a => checkedIds.has(a.id)),
    [artworks, checkedIds],
  )

  // Group preview
  const groups = useMemo(() => {
    const size = activeTab === 'photographs' ? GROUP_SIZE_PHOTO : GROUP_SIZE_2D
    const result: Artwork[][] = []
    for (let i = 0; i < selectedArtworks.length; i += size) {
      result.push(selectedArtworks.slice(i, i + size))
    }
    return result
  }, [selectedArtworks, activeTab])

  const toggleOne = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setCheckedIds(new Set(artworks.map(a => a.id)))
  const deselectAll = () => setCheckedIds(new Set())
  const preSelectPhotographs = () =>
    setCheckedIds(new Set(artworks.filter(a => a.mediaType === 'photography').map(a => a.id)))

  const copyGroupTitles = async (group: Artwork[], groupIndex: number) => {
    const titles = group.map(a => a.title || a.aiAnalysis?.suggestedTitle || 'Untitled').join(', ')
    try {
      await navigator.clipboard.writeText(titles)
      setCopiedGroup(groupIndex)
      setTimeout(() => setCopiedGroup(null), 2000)
    } catch {
      showToast('Could not access clipboard — copy from the downloaded file instead')
    }
  }

  const handleGenerate = async () => {
    if (generating || selectedArtworks.length === 0) return
    setGenerating(true)
    try {
      const blob = await generatePhotographsPackage(selectedArtworks, artistName)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `copyright-photographs-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Package downloaded')
    } finally {
      setGenerating(false)
    }
  }

  // Close on backdrop click
  const onBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  const missingCount = selectedArtworks.filter(
    a => !a.title && !a.aiAnalysis?.suggestedTitle,
  ).length

  return (
    <div
      onClick={onBackdrop}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 16px',
      }}
    >
      <div
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          width: '100%',
          maxWidth: 860,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px 14px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 13, fontFamily: 'var(--font-body)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text)' }}>
              Copyright Registration
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3, fontFamily: 'var(--font-body)' }}>
              U.S. Copyright Office · Group Registration
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 18, lineHeight: 1, padding: 4 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          padding: '0 24px',
        }}>
          {(['photographs', '2d-visual-art'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === tab ? 'var(--accent)' : 'var(--text-dim)',
                fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.12em',
                textTransform: 'uppercase', cursor: 'pointer',
                padding: '12px 16px 10px', transition: 'color 0.15s',
                marginBottom: -1,
              }}
            >
              {tab === 'photographs' ? 'Photographs' : '2D Visual Art'}
            </button>
          ))}
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {activeTab === '2d-visual-art' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: 240, textAlign: 'center', gap: 12,
            }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ opacity: 0.3 }}>
                <rect x="4" y="4" width="28" height="28" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M4 13h28M13 4v28" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 2"/>
              </svg>
              <div style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-body)', letterSpacing: '0.06em' }}>
                Coming soon
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', maxWidth: 380, lineHeight: 1.7, fontFamily: 'var(--font-body)' }}>
                We&apos;re researching the exact columns required for the U.S. Copyright Office Group Registration of
                Visual Art Works (VA). This section will support groups of up to {GROUP_SIZE_2D} works per filing.
              </div>
            </div>
          )}

          {activeTab === 'photographs' && (
            <>
              {/* Controls row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)', letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 4 }}>
                  {checkedIds.size} selected
                </span>
                <SmallButton onClick={selectAll}>Select all</SmallButton>
                <SmallButton onClick={deselectAll}>Deselect all</SmallButton>
                <SmallButton onClick={preSelectPhotographs}>Pre-select photographs</SmallButton>
              </div>

              {/* Group summary */}
              {selectedArtworks.length > 0 && (
                <div style={{
                  background: 'rgba(201,169,110,0.06)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  padding: '12px 14px',
                  marginBottom: 16,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
                    Filing groups ({GROUP_SIZE_PHOTO} per group · ${85} each)
                  </div>
                  {groups.map((group, gi) => (
                    <div key={gi} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--font-body)', minWidth: 72 }}>
                        Group {gi + 1} — {group.length} {group.length === 1 ? 'work' : 'works'}
                      </span>
                      <button
                        onClick={() => copyGroupTitles(group, gi)}
                        style={{
                          background: copiedGroup === gi ? 'rgba(201,169,110,0.18)' : 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: 2, padding: '3px 10px',
                          color: copiedGroup === gi ? 'var(--accent)' : 'var(--text-dim)',
                          fontFamily: 'var(--font-body)', fontSize: 10,
                          letterSpacing: '0.1em', textTransform: 'uppercase',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {copiedGroup === gi ? '✓ Copied' : 'Copy titles for eCO'}
                      </button>
                      {group.some(a => !a.title && !a.aiAnalysis?.suggestedTitle) && (
                        <span style={{ fontSize: 10, color: '#e0a05a', fontFamily: 'var(--font-body)' }}>
                          ⚠ some works missing title
                        </span>
                      )}
                    </div>
                  ))}
                  {missingCount > 0 && (
                    <div style={{ fontSize: 11, color: '#e0a05a', fontFamily: 'var(--font-body)', marginTop: 4 }}>
                      {missingCount} {missingCount === 1 ? 'work' : 'works'} with no title will be flagged in the CSV — edit them before submitting.
                    </div>
                  )}
                </div>
              )}

              {/* Artwork grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                gap: 8,
              }}>
                {artworks.map(a => {
                  const checked = checkedIds.has(a.id)
                  const displayTitle = a.title || a.aiAnalysis?.suggestedTitle || ''
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggleOne(a.id)}
                      style={{
                        position: 'relative',
                        background: checked ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 3,
                        padding: 0, cursor: 'pointer', overflow: 'hidden',
                        display: 'flex', flexDirection: 'column',
                        transition: 'border-color 0.15s, background 0.15s',
                        textAlign: 'left',
                      }}
                    >
                      {/* Thumbnail */}
                      <div style={{ width: '100%', aspectRatio: '1', overflow: 'hidden', background: '#111' }}>
                        {a.imageData.startsWith('http') ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.imageData}
                            alt={displayTitle || 'artwork'}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: 'var(--border)' }} />
                        )}
                      </div>
                      {/* Title */}
                      <div style={{
                        padding: '5px 6px',
                        fontSize: 10, color: displayTitle ? 'var(--text-dim)' : '#e0a05a',
                        fontFamily: 'var(--font-body)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        lineHeight: 1.3,
                      }}>
                        {displayTitle || '⚠ No title'}
                      </div>
                      {/* Checkbox overlay */}
                      <div style={{
                        position: 'absolute', top: 5, right: 5,
                        width: 16, height: 16, borderRadius: 2,
                        background: checked ? 'var(--accent)' : 'rgba(0,0,0,0.5)',
                        border: `1px solid ${checked ? 'var(--accent)' : 'rgba(255,255,255,0.3)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s, border-color 0.15s',
                        pointerEvents: 'none',
                      }}>
                        {checked && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'photographs' && (
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: '14px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, flexShrink: 0,
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
              {selectedArtworks.length > 0
                ? `Downloads ${groups.length} zip ${groups.length === 1 ? 'folder' : 'folders'} · each contains a title-template CSV + PASTE-INTO-ECO.txt + deposit images`
                : 'Select at least one work to generate a package'}
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || selectedArtworks.length === 0}
              style={{
                background: selectedArtworks.length === 0 ? 'transparent' : 'var(--accent)',
                border: '1px solid var(--accent)',
                borderRadius: 2, padding: '7px 20px',
                color: selectedArtworks.length === 0 ? 'var(--accent)' : 'var(--bg)',
                fontFamily: 'var(--font-body)', fontSize: 11,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                cursor: selectedArtworks.length === 0 || generating ? 'default' : 'pointer',
                opacity: generating ? 0.6 : selectedArtworks.length === 0 ? 0.4 : 1,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {generating ? 'Generating…' : 'Generate & Download'}
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 3, padding: '8px 18px',
          fontSize: 12, color: 'var(--text)', fontFamily: 'var(--font-body)',
          pointerEvents: 'none', zIndex: 9999,
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function SmallButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 2, padding: '4px 10px',
        color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
        fontSize: 10, letterSpacing: '0.09em', textTransform: 'uppercase',
        cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = 'var(--text)'
        e.currentTarget.style.borderColor = 'var(--text-dim)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'var(--text-dim)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {children}
    </button>
  )
}
