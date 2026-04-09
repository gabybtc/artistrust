"use client"
import { useState, useMemo, useCallback, useEffect } from 'react'
import type { Artwork } from '@/lib/types'
import type { Tab } from '@/lib/types'
import type { Plan } from '@/lib/plans'
import { canExportCopyright } from '@/lib/plans'
import {
  generateCopyrightPackage,
  initialsFromName,
  buildApplicationGroups,
  getBatchSize,
  getFilingFee,
  titleToDepositName,
  BATCH_SIZE,
  type WorkType,
  type PublishedStatus,
} from '@/lib/copyrightPackage'

interface Props {
  artworks: Artwork[]
  tabs: Tab[]
  initialSelected: Set<string>
  artistName: string
  onClose: () => void
  plan?: Plan
  onUpgradeClick?: () => void
}

type Step = 'configure' | 'select' | 'review-selection' | 'preview'

// ─── Upgrade gate ─────────────────────────────────────────────────────────────

function UpgradeGate({ onClose, onUpgradeClick }: { onClose: () => void; onUpgradeClick?: () => void }) {
  return (
    <div
      role="dialog" aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 4, padding: '44px 48px', maxWidth: 420, textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, marginBottom: 16 }}>©</div>
        <h3 style={{
          fontFamily: 'var(--font-display)', fontSize: 20,
          fontWeight: 400, fontStyle: 'italic', color: 'var(--text)', marginBottom: 12,
        }}>Studio plan required</h3>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-body)', lineHeight: 1.7, marginBottom: 28 }}>
          Copyright export packages are available on Studio and Archive plans. Generate
          submission-ready packages for the U.S. Copyright Office with deposit images,
          code strings, and a plain-English step-by-step guide.
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

// ─── Small reusable button ────────────────────────────────────────────────────

function SmallButton({ onClick, children, active }: { onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'rgba(201,169,110,0.12)' : 'transparent',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 2, padding: '4px 10px',
        color: active ? 'var(--accent)' : 'var(--text-dim)',
        fontFamily: 'var(--font-body)',
        fontSize: 10, letterSpacing: '0.09em', textTransform: 'uppercase',
        cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.color = 'var(--text)'
          e.currentTarget.style.borderColor = 'var(--text-dim)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.color = 'var(--text-dim)'
          e.currentTarget.style.borderColor = 'var(--border)'
        }
      }}
    >
      {children}
    </button>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ step }: { step: Step }) {
  const steps: Step[] = ['configure', 'select', 'review-selection', 'preview']
  const labels = ['Configure', 'Select works', 'Review selection', 'Review & export']
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: s === step ? 'var(--accent)' : steps.indexOf(step) > i ? 'var(--accent)' : 'var(--border)',
            transition: 'background 0.2s',
            opacity: s === step ? 1 : steps.indexOf(step) > i ? 0.5 : 0.3,
          }} />
          <span style={{
            fontSize: 10, fontFamily: 'var(--font-body)', letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: s === step ? 'var(--accent)' : 'var(--text-dim)',
            opacity: s === step ? 1 : 0.5,
          }}>{labels[i]}</span>
          {i < steps.length - 1 && (
            <div style={{ width: 16, height: 1, background: 'var(--border)', marginLeft: 2, marginRight: 2 }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function CopyrightExportModal({ artworks, tabs, initialSelected, artistName, onClose, plan = 'preserve', onUpgradeClick }: Props) {
  const allowed = canExportCopyright(plan)
  if (!allowed) return <UpgradeGate onClose={onClose} onUpgradeClick={onUpgradeClick} />

  // ── Step state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('configure')

  // ── Configuration state ───────────────────────────────────────────────────
  const [workType, setWorkType] = useState<WorkType>('photographs')
  const [publishedStatus, setPublishedStatus] = useState<PublishedStatus>('unpublished')
  const [prefix, setPrefix] = useState(() => initialsFromName(artistName))
  const [prefixError, setPrefixError] = useState('')

  // ── Work selection ────────────────────────────────────────────────────────
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set(initialSelected))

  useEffect(() => { setCheckedIds(new Set(initialSelected)) }, [initialSelected])
  useEffect(() => { setPrefix(initialsFromName(artistName)) }, [artistName])

  // ── Generation state ──────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }, [])

  // ── Derived data ──────────────────────────────────────────────────────────
  const selectedArtworks = useMemo(
    () => artworks.filter(a => checkedIds.has(a.id)),
    [artworks, checkedIds],
  )

  const worksWithNoTitle = useMemo(
    () => selectedArtworks.filter(a => !a.title && !a.aiAnalysis?.suggestedTitle),
    [selectedArtworks],
  )

  // Cost preview (uses placeholder image sizes of 0 since we don't know sizes yet)
  const costPreview = useMemo(() => {
    if (selectedArtworks.length === 0) return null
    const dummySizes = new Map<string, number>()
    const previewCodes = workType === '2d-visual-art'
      ? selectedArtworks.map(a => titleToDepositName(a.title || a.aiAnalysis?.suggestedTitle || 'Untitled'))
      : selectedArtworks.map((_, i) => `${prefix}${String(i + 1).padStart(3, '0')}`)
    const groups = buildApplicationGroups(selectedArtworks, previewCodes, workType, dummySizes, publishedStatus)
    const totalApps = groups.length
    const fee = getFilingFee(workType, publishedStatus)
    const totalPasteBatches = groups.reduce((sum, g) => sum + g.pasteBatches.length, 0)
    return { totalApps, fee, totalFee: totalApps * fee, totalPasteBatches, groups }
  }, [selectedArtworks, workType, publishedStatus, prefix])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const toggleOne = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const validatePrefix = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
    setPrefix(clean)
    setPrefixError(clean.length < 1 ? 'Prefix must be at least 1 character' : '')
  }

  const handleGenerate = async () => {
    if (generating || selectedArtworks.length === 0 || prefixError) return
    setGenerating(true)
    try {
      const blob = await generateCopyrightPackage({
        artworks: selectedArtworks,
        artistName,
        prefix,
        workType,
        publishedStatus,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ArtisTrust_Copyright_Export_${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Package downloaded')
    } catch {
      showToast('Something went wrong — please try again')
    } finally {
      setGenerating(false)
    }
  }

  const onBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderConfigure = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Type of work */}
      <div>
        <SectionLabel>Type of work</SectionLabel>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          {([
            { id: 'photographs', label: 'Photographs', sub: `Up to ${BATCH_SIZE.photographs} per application` },
            { id: '2d-visual-art', label: 'Paintings & Visual Art', sub: `Up to ${getBatchSize('2d-visual-art', publishedStatus)} per application` },
          ] as const).map(opt => (
            <button
              key={opt.id}
              onClick={() => setWorkType(opt.id)}
              style={{
                flex: 1,
                padding: '14px 16px',
                background: workType === opt.id ? 'rgba(201,169,110,0.08)' : 'var(--surface)',
                border: `1px solid ${workType === opt.id ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 3, cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{ fontSize: 13, color: workType === opt.id ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>
                {opt.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
                {opt.sub}
              </div>
            </button>
          ))}
        </div>
        {workType === '2d-visual-art' && (
          <div style={{ marginTop: 10, padding: '12px 14px', background: 'rgba(201,169,110,0.05)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 2 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)', lineHeight: 1.75 }}>
              Group Registration of Unpublished Works (GRUW) for visual artworks costs $55 per 10 unpublished works,
              while Group Registration of 2D (GR2D) is $85 per 20 published works. For a catalogue of 500 paintings
              that could run to $2,750 or more, so we&apos;d recommend focusing on your most significant or valuable
              works first — pieces you&apos;d want to protect if someone reproduced them commercially. You can always
              register more works in future batches.
            </div>
          </div>
        )}
      </div>

      {/* Published status */}
      <div>
        <SectionLabel>Published or unpublished?</SectionLabel>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-body)', lineHeight: 1.7, margin: '6px 0 10px' }}>
          Have these works been sold, licensed, or made publicly available for download?
          If you&apos;re not sure, choose <em>Unpublished</em>.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          {([
            { id: 'unpublished', label: 'Unpublished', sub: 'Not yet sold, licensed, or publicly distributed' },
            { id: 'published', label: 'Published', sub: 'Previously sold, licensed, or publicly released' },
          ] as const).map(opt => (
            <button
              key={opt.id}
              onClick={() => setPublishedStatus(opt.id)}
              style={{
                flex: 1,
                padding: '14px 16px',
                background: publishedStatus === opt.id ? 'rgba(201,169,110,0.08)' : 'var(--surface)',
                border: `1px solid ${publishedStatus === opt.id ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 3, cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{ fontSize: 13, color: publishedStatus === opt.id ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--font-body)', marginBottom: 4 }}>
                {opt.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
                {opt.sub}
              </div>
            </button>
          ))}
        </div>
        {publishedStatus === 'published' && workType === '2d-visual-art' && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(224,160,90,0.08)', border: '1px solid rgba(224,160,90,0.25)', borderRadius: 2 }}>
            <span style={{ fontSize: 11, color: '#e0a05a', fontFamily: 'var(--font-body)' }}>
              ⚠ Published visual artworks must be grouped by calendar year for separate applications.
              Make sure your selected works are from the same year, or split them manually.
            </span>
          </div>
        )}
      </div>

      {/* Code prefix — photographs only; visual art files are named directly from titles */}
      {workType !== '2d-visual-art' && (
      <div>
        <SectionLabel>Reference code prefix</SectionLabel>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-body)', lineHeight: 1.7, margin: '6px 0 10px' }}>
          Each work gets a unique code like <strong style={{ color: 'var(--text)' }}>{prefix || 'RB'}001</strong>,{' '}
          <strong style={{ color: 'var(--text)' }}>{prefix || 'RB'}002</strong>.
          These are used as deposit file names and in your Reference Template.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            value={prefix}
            onChange={e => validatePrefix(e.target.value)}
            maxLength={4}
            style={{
              width: 80, padding: '7px 10px',
              background: 'var(--bg)', border: `1px solid ${prefixError ? '#e0a05a' : 'var(--border)'}`,
              borderRadius: 2, color: 'var(--text)', fontSize: 14,
              fontFamily: 'var(--font-body)', fontWeight: 500, letterSpacing: '0.1em',
              outline: 'none', textTransform: 'uppercase',
            }}
            placeholder="RB"
          />
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
            Auto-generated from artist name · 1–4 letters/numbers
          </span>
        </div>
        {prefixError && <div style={{ fontSize: 11, color: '#e0a05a', marginTop: 6, fontFamily: 'var(--font-body)' }}>{prefixError}</div>}
      </div>
      )}
    </div>
  )

  const renderSelect = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)', letterSpacing: '0.1em', textTransform: 'uppercase', marginRight: 4 }}>
          {checkedIds.size} selected
        </span>
        <SmallButton onClick={() => setCheckedIds(new Set(artworks.map(a => a.id)))}>Select all</SmallButton>
        <SmallButton onClick={() => setCheckedIds(new Set())}>Deselect all</SmallButton>
        {tabs.map(tab => {
          const count = artworks.filter(a => (a.mediaType ?? tabs[0]?.id) === tab.id).length
          if (count === 0) return null
          return (
            <SmallButton
              key={tab.id}
              onClick={() => setCheckedIds(new Set(artworks.filter(a => (a.mediaType ?? tabs[0]?.id) === tab.id).map(a => a.id)))}
            >
              Select {tab.label} ({count})
            </SmallButton>
          )
        })}
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
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
              <div style={{ width: '100%', aspectRatio: '1', overflow: 'hidden', background: '#111' }}>
                {a.imageData.startsWith('http') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.imageData} alt={displayTitle || 'artwork'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'var(--border)' }} />
                )}
              </div>
              <div style={{
                padding: '5px 6px',
                fontSize: 10, color: displayTitle ? 'var(--text-dim)' : '#e0a05a',
                fontFamily: 'var(--font-body)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                lineHeight: 1.3,
              }}>
                {displayTitle || '⚠ No title'}
              </div>
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
    </div>
  )

  const renderReviewSelection = () => {
    if (selectedArtworks.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-dim)', fontSize: 13, fontFamily: 'var(--font-body)' }}>
          No works selected — go back and select at least one.
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)', lineHeight: 1.7 }}>
          These are the {selectedArtworks.length} work{selectedArtworks.length === 1 ? '' : 's'} you&apos;ve selected.
          Click any to remove it from the export, then continue when you&apos;re happy with your selection.
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
          gap: 8,
        }}>
          {selectedArtworks.map(a => {
            const displayTitle = a.title || a.aiAnalysis?.suggestedTitle || ''
            return (
              <button
                key={a.id}
                onClick={() => toggleOne(a.id)}
                title="Click to remove from selection"
                style={{
                  position: 'relative',
                  background: 'rgba(201,169,110,0.12)',
                  border: '1px solid var(--accent)',
                  borderRadius: 3,
                  padding: 0, cursor: 'pointer', overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                  textAlign: 'left',
                }}
              >
                <div style={{ width: '100%', aspectRatio: '1', overflow: 'hidden', background: '#111', position: 'relative' }}>
                  {a.imageData.startsWith('http') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.imageData} alt={displayTitle || 'artwork'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'var(--border)' }} />
                  )}
                  {/* Remove overlay on hover */}
                  <div className="remove-overlay" style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(180,60,60,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 0.15s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4L12 12M12 4L4 12" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>
                <div style={{
                  padding: '5px 6px',
                  fontSize: 10, color: displayTitle ? 'var(--text-dim)' : '#e0a05a',
                  fontFamily: 'var(--font-body)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  lineHeight: 1.3,
                }}>
                  {displayTitle || '⚠ No title'}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const renderPreview = () => {
    if (!costPreview || selectedArtworks.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-dim)', fontSize: 13, fontFamily: 'var(--font-body)' }}>
          No works selected — go back and select at least one.
        </div>
      )
    }

    const { totalApps, fee, totalFee, groups } = costPreview

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Cost warning — visual art only */}
        {workType === '2d-visual-art' && (
          <div style={{ padding: '12px 14px', background: 'rgba(224,160,90,0.08)', border: '1px solid rgba(224,160,90,0.25)', borderRadius: 2 }}>
            <div style={{ fontSize: 11, color: '#e0a05a', fontFamily: 'var(--font-body)', lineHeight: 1.75 }}>
              ⚠ Registering {selectedArtworks.length} painting{selectedArtworks.length === 1 ? '' : 's'} will require {totalApps} application{totalApps === 1 ? '' : 's'} at ${fee} each = ${totalFee} total.
              We recommend selecting only your most important works — pieces you&apos;d want to protect if someone reproduced them commercially.
            </div>
          </div>
        )}

        {/* Cost summary */}
        <div style={{
          padding: '16px 18px',
          background: 'rgba(201,169,110,0.06)',
          border: '1px solid var(--border)',
          borderRadius: 3,
        }}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 12 }}>
            <CostItem label="Works selected" value={String(selectedArtworks.length)} />
            <CostItem label="Applications" value={String(totalApps)} />
            <CostItem label="Fee per application" value={`$${fee}`} />
            <CostItem label="Estimated total fee" value={`$${totalFee}`} accent />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
            Each application is a separate filing. You pay ${fee} per application at copyright.gov.
            These are the U.S. Copyright Office&apos;s fees — ArtisTrust charges nothing for the export.
          </div>
        </div>

        {/* Application breakdown */}
        <div>
          <SectionLabel>Package structure</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {groups.map(g => (
              <div
                key={g.appIndex}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 2,
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-body)', letterSpacing: '0.1em', textTransform: 'uppercase', minWidth: 100 }}>
                  {workType === '2d-visual-art' ? `Batch ${g.appIndex}` : `Application ${g.appIndex}`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--font-body)', flex: 1 }}>
                  {g.works.length} {g.works.length === 1 ? 'work' : 'works'}
                  {workType === '2d-visual-art' ? (
                    <span style={{ color: 'var(--text-dim)' }}>{' · '}Reference_Sheet.csv + Deposit_Images.zip</span>
                  ) : (
                    <>
                      {' · '}
                      {g.pasteBatches.length} paste {g.pasteBatches.length === 1 ? 'batch' : 'batches'}
                      {' · '}
                      codes {g.works[0].code}–{g.works[g.works.length - 1].code}
                    </>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
                  ${fee}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Warnings */}
        {worksWithNoTitle.length > 0 && (
          <div style={{ padding: '10px 14px', background: 'rgba(224,160,90,0.08)', border: '1px solid rgba(224,160,90,0.25)', borderRadius: 2 }}>
            <div style={{ fontSize: 11, color: '#e0a05a', fontFamily: 'var(--font-body)', lineHeight: 1.7 }}>
              ⚠ {worksWithNoTitle.length} {worksWithNoTitle.length === 1 ? 'work has' : 'works have'} no title.
              The file name will be used as the code reference. Edit these in your catalogue before submitting.
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 2 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-body)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--text)' }}>Disclaimer:</strong> This tool generates a submission-ready package.
            ArtisTrust does not submit to copyright.gov on your behalf, does not provide legal advice, and is not
            responsible for the outcome of any filing. For complex situations, consult a copyright attorney.
          </div>
        </div>
      </div>
    )
  }

  // ── Modal shell ───────────────────────────────────────────────────────────

  const canProceedFromConfigure = workType === '2d-visual-art' || (prefix.length > 0 && !prefixError)
  const canProceedFromSelect = checkedIds.size > 0

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
          maxHeight: '90vh',
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
              Copyright Registration Package
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3, fontFamily: 'var(--font-body)' }}>
              U.S. Copyright Office · Group Registration · {artistName}
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

        {/* Step indicator */}
        <div style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <StepDots step={step} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px' }}>
          {step === 'configure' && renderConfigure()}
          {step === 'select' && renderSelect()}
          {step === 'review-selection' && renderReviewSelection()}
          {step === 'preview' && renderPreview()}
        </div>

        {/* Footer nav */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexShrink: 0,
        }}>
          <button
            onClick={() => {
              if (step === 'configure') onClose()
              else if (step === 'select') setStep('configure')
              else if (step === 'review-selection') setStep('select')
              else setStep('review-selection')
            }}
            style={{
              background: 'transparent', border: '1px solid var(--border)', borderRadius: 2,
              padding: '7px 20px', color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
              fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
            }}
          >
            {step === 'configure' ? 'Cancel' : '← Back'}
          </button>

          {step !== 'preview' ? (
            <button
              onClick={() => {
                if (step === 'configure') setStep('select')
                else if (step === 'select') setStep('review-selection')
                else setStep('preview')
              }}
              disabled={step === 'configure' ? !canProceedFromConfigure : !canProceedFromSelect}
              style={{
                background: (step === 'configure' ? canProceedFromConfigure : canProceedFromSelect) ? 'var(--accent)' : 'transparent',
                border: '1px solid var(--accent)',
                borderRadius: 2, padding: '7px 20px',
                color: (step === 'configure' ? canProceedFromConfigure : canProceedFromSelect) ? 'var(--bg)' : 'var(--accent)',
                fontFamily: 'var(--font-body)', fontSize: 11,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                cursor: (step === 'configure' ? canProceedFromConfigure : canProceedFromSelect) ? 'pointer' : 'default',
                opacity: (step === 'configure' ? canProceedFromConfigure : canProceedFromSelect) ? 1 : 0.4,
                transition: 'all 0.15s',
              }}
            >
              {step === 'configure' ? 'Select works →' : step === 'select' ? `Review ${checkedIds.size} selected →` : `Continue to export →`}
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating || selectedArtworks.length === 0}
              style={{
                background: selectedArtworks.length > 0 ? 'var(--accent)' : 'transparent',
                border: '1px solid var(--accent)',
                borderRadius: 2, padding: '7px 24px',
                color: selectedArtworks.length > 0 ? 'var(--bg)' : 'var(--accent)',
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
          )}
        </div>
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontFamily: 'var(--font-body)', letterSpacing: '0.14em',
      textTransform: 'uppercase', color: 'var(--text-dim)',
    }}>
      {children}
    </div>
  )
}

function CostItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-body)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: accent ? 18 : 15, color: accent ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--font-body)', fontWeight: accent ? 500 : 400 }}>
        {value}
      </div>
    </div>
  )
}
