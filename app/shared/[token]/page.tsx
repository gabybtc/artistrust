'use client'
import { use, useEffect, useState } from 'react'
import type { Artwork } from '@/lib/types'

interface SharedData {
  artworks: RawRow[]
  profile: { fullName?: string; studioName?: string; bio?: string; website?: string }
  granteeName: string
}

// Minimal row shape returned from the API (matches the DB row, not the Artwork type)
interface RawRow {
  id: string
  image_url: string
  title: string
  year: string
  place: string
  width: string
  height: string
  unit: string
  material: string
  media_type: string
  status: string
  ai_analysis?: Artwork['aiAnalysis']
}

function toArtwork(r: RawRow): Artwork {
  return {
    id: r.id,
    imageData: r.image_url,
    fileName: '',
    title: r.title ?? '',
    year: r.year ?? '',
    place: r.place ?? '',
    location: '',
    width: r.width ?? '',
    height: r.height ?? '',
    unit: (r.unit as 'cm' | 'in') ?? 'cm',
    material: r.material ?? '',
    mediaType: (r.media_type as 'painting' | 'photography') ?? 'painting',
    status: r.status as Artwork['status'],
    uploadedAt: '',
    aiAnalysis: r.ai_analysis,
    copyrightStatus: 'automatic',
    copyrightHolder: '',
    copyrightYear: '',
    copyrightRegNumber: '',
  }
}

export default function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<SharedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'painting' | 'photography'>('painting')
  const [selected, setSelected] = useState<Artwork | null>(null)

  useEffect(() => {
    fetch(`/api/shared/${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) { setError(json.error); return }
        setData(json)
        // Auto-switch to photography tab if there are no paintings
        const hasPaintings = json.artworks.some((a: RawRow) => (a.media_type ?? 'painting') === 'painting')
        if (!hasPaintings) setActiveTab('photography')
      })
      .catch(() => setError('Failed to load catalog.'))
  }, [token])

  if (error) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 40,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(224,85,85,0.1)', border: '1px solid rgba(224,85,85,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#e05555', fontSize: 20,
          }}>✕</div>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 18, fontStyle: 'italic',
            color: 'var(--text)', marginBottom: 10,
          }}>
            {error}
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
            The link may have been revoked or is no longer valid.
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[0, 0.1, 0.2, 0.3, 0.4].map((delay, i) => (
            <div key={i} style={{
              width: 3, height: 18, background: 'var(--accent)', borderRadius: 2,
              animation: `wave 1s ease-in-out ${delay}s infinite`,
            }} />
          ))}
        </div>
      </div>
    )
  }

  const artworks = data.artworks.map(toArtwork)
  const tabArtworks = artworks.filter(a => (a.mediaType ?? 'painting') === activeTab)
  const paintingCount = artworks.filter(a => (a.mediaType ?? 'painting') === 'painting').length
  const photoCount = artworks.filter(a => a.mediaType === 'photography').length

  const artistName = data.profile.fullName || 'Artist'
  const initials = artistName
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 62,
        position: 'sticky', top: 0,
        background: 'rgba(10,10,10,0.96)',
        backdropFilter: 'blur(12px)',
        zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22, fontWeight: 400, fontStyle: 'italic',
            letterSpacing: '0.01em', color: 'var(--text)',
          }}>
            ArtisTrust
          </span>
          <span style={{
            fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'var(--accent-dim)', fontFamily: 'var(--font-body)',
          }}>
            Studio
          </span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(201,169,110,0.06)',
          border: '1px solid rgba(201,169,110,0.2)',
          borderRadius: 2, padding: '5px 12px',
        }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect x="1" y="4" width="9" height="6" rx="1" stroke="var(--accent)" strokeWidth="1"/>
            <path d="M3.5 4V2.75a2 2 0 0 1 4 0V4" stroke="var(--accent)" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          <span style={{
            fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--accent)', fontFamily: 'var(--font-body)',
          }}>
            View Only
          </span>
        </div>
      </header>

      {/* Artist banner */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        padding: '28px 40px',
        background: 'var(--surface)',
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(201,169,110,0.12)',
          border: '1px solid var(--accent-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)',
          fontSize: 20, fontStyle: 'italic', color: 'var(--accent)',
          flexShrink: 0,
        }}>
          {initials}
        </div>
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20, fontWeight: 400, fontStyle: 'italic',
            color: 'var(--text)', marginBottom: 4,
          }}>
            {artistName}
          </h2>
          {data.profile.studioName && (
            <div style={{
              fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--accent-dim)', fontFamily: 'var(--font-body)', marginBottom: 6,
            }}>
              {data.profile.studioName}
            </div>
          )}
          {data.profile.bio && (
            <p style={{
              fontSize: 13, color: 'var(--text-dim)',
              fontFamily: 'var(--font-body)', lineHeight: 1.6,
              maxWidth: 600,
            }}>
              {data.profile.bio}
            </p>
          )}
        </div>
        {data.granteeName && (
          <div style={{
            marginLeft: 'auto',
            fontSize: 12, color: 'var(--muted)',
            fontFamily: 'var(--font-body)', textAlign: 'right', lineHeight: 1.6,
          }}>
            Shared with<br />
            <span style={{ color: 'var(--text-dim)' }}>{data.granteeName}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        padding: '0 40px',
        background: 'var(--surface)',
      }}>
        {([
          { key: 'painting' as const, label: 'Paintings', count: paintingCount },
          { key: 'photography' as const, label: 'Photography', count: photoCount },
        ]).map(tab => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontSize: 12,
                fontWeight: 400, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: isActive ? 'var(--text)' : 'var(--text-dim)',
                padding: '14px 24px 12px',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'color 0.18s',
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  fontSize: 10,
                  background: isActive ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.06)',
                  borderRadius: 100, padding: '2px 7px',
                  color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                  fontWeight: 500,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Grid */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '36px 40px 80px' }}>
        {tabArtworks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18, fontStyle: 'italic', color: 'var(--muted)',
            }}>
              No {activeTab === 'photography' ? 'photographs' : 'paintings'} in this catalog
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))',
            gap: 18,
          }}>
            {tabArtworks.map(artwork => (
              <SharedArtworkCard
                key={artwork.id}
                artwork={artwork}
                onClick={() => setSelected(artwork)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Read-only detail modal */}
      {selected && (
        <SharedArtworkModal artwork={selected} onClose={() => setSelected(null)} />
      )}

      {/* Footer note */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '20px 40px',
        textAlign: 'center',
        background: 'var(--surface)',
      }}>
        <p style={{
          fontSize: 11, color: 'var(--muted)',
          fontFamily: 'var(--font-body)', letterSpacing: '0.06em',
        }}>
          This is a private, read-only view of {artistName}&apos;s art catalog.
          Shared via ArtisTrust Studio.
        </p>
      </div>
    </main>
  )
}

// ── Shared Artwork Card ────────────────────────────────────────────────────────

function SharedArtworkCard({ artwork, onClick }: { artwork: Artwork; onClick: () => void }) {
  const title = artwork.title || artwork.aiAnalysis?.suggestedTitle || ''
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.22s, transform 0.22s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent-dim)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden', background: 'var(--surface)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artwork.imageData}
          alt={title || 'Artwork'}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 15, fontStyle: 'italic', fontWeight: 400,
          color: title ? 'var(--text)' : 'var(--muted)',
          marginBottom: 4, lineHeight: 1.3,
        }}>
          {title || 'Untitled'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {artwork.year && (
            <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
              {artwork.year}
            </span>
          )}
          {artwork.aiAnalysis?.medium && (
            <span style={{
              fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--accent)', fontFamily: 'var(--font-body)',
              background: 'rgba(201,169,110,0.08)',
              border: '1px solid var(--accent-dim)',
              borderRadius: 2, padding: '2px 7px',
            }}>
              {artwork.aiAnalysis.medium}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared Artwork Modal (read-only) ──────────────────────────────────────────

function SharedArtworkModal({ artwork, onClose }: { artwork: Artwork; onClose: () => void }) {
  const title = artwork.title || artwork.aiAnalysis?.suggestedTitle || 'Untitled'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const dim = [artwork.width, artwork.height].filter(Boolean)
  const dimString = dim.length === 2 ? `${dim[0]} × ${dim[1]} ${artwork.unit}` : ''

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', padding: '36px 20px',
        overflowY: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 2,
        width: '100%', maxWidth: 760,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        marginBottom: 36,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16, fontStyle: 'italic', color: 'var(--text)',
          }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: 20, lineHeight: 1, padding: '2px 4px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px' }}>
          {/* Image */}
          <div style={{ background: 'var(--surface)', maxHeight: 520, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={artwork.imageData}
              alt={title}
              style={{ maxWidth: '100%', maxHeight: 520, objectFit: 'contain', display: 'block' }}
            />
          </div>

          {/* Metadata */}
          <div style={{ padding: '24px 20px', borderLeft: '1px solid var(--border)', overflowY: 'auto', maxHeight: 520 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Year', value: artwork.year },
                { label: 'Location', value: artwork.place },
                { label: 'Dimensions', value: dimString },
                { label: 'Materials', value: artwork.material },
                { label: 'Style', value: artwork.aiAnalysis?.style },
                { label: 'Medium', value: artwork.aiAnalysis?.medium },
                { label: 'Subject', value: artwork.aiAnalysis?.subject },
              ].filter(f => f.value).map(f => (
                <div key={f.label}>
                  <div style={{
                    fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: 'var(--text-dim)', fontFamily: 'var(--font-body)', marginBottom: 4,
                  }}>
                    {f.label}
                  </div>
                  <div style={{
                    fontSize: 14, color: 'var(--text)',
                    fontFamily: 'var(--font-body)', lineHeight: 1.4,
                  }}>
                    {f.value}
                  </div>
                </div>
              ))}
              {artwork.aiAnalysis?.description && (
                <div>
                  <div style={{
                    fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: 'var(--text-dim)', fontFamily: 'var(--font-body)', marginBottom: 4,
                  }}>
                    Description
                  </div>
                  <p style={{
                    fontSize: 13, color: 'var(--text-dim)',
                    fontFamily: 'var(--font-body)', lineHeight: 1.6,
                  }}>
                    {artwork.aiAnalysis.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
