"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { Artwork } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { fetchArtworks, upsertArtworks, deleteArtworkFromDB } from '@/lib/db'
import { useUploadQueue } from '@/lib/useUploadQueue'
import ArtworkModal from './components/ArtworkModal'
import ArtworkCard from './components/ArtworkCard'
import DropZone from './components/DropZone'
import AuthModal from './components/AuthModal'
import LegalModal from './components/LegalModal'
import ProfileModal from './components/ProfileModal'
import QueueDrawer from './components/QueueDrawer'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [selected, setSelected] = useState<Artwork | null>(null)
  const [activeTab, setActiveTab] = useState<'painting' | 'photography'>('painting')
  const [filter, setFilter] = useState<'all' | 'complete' | 'pending'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [mounted, setMounted] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [legalOpen, setLegalOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auth: detect session on mount and watch for changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setMounted(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load artworks from DB when user signs in; clear when signed out
  useEffect(() => {
    if (!user) { setArtworks([]); return }
    fetchArtworks(user.id).then(setArtworks)
  }, [user])

  // Debounced sync to DB — only persists artworks that have a real URL (not temp base64)
  useEffect(() => {
    if (!user || !mounted) return
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      upsertArtworks(artworks, user.id)
    }, 1500)
  }, [artworks, user, mounted])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }, [])

  // ── Upload queue — handles unlimited files, folders, background processing ──
  const onArtworkAdded = useCallback((artwork: Artwork) => {
    setArtworks(prev => [artwork, ...prev])
  }, [])

  const onArtworkUpdated = useCallback((id: string, updates: Partial<Artwork>) => {
    setArtworks(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
  }, [])

  const uploadQueue = useUploadQueue({
    userId: user?.id ?? null,
    activeTab,
    onArtworkAdded,
    onArtworkUpdated,
  })

  const handleFiles = useCallback((files: File[]) => {
    if (!user) return
    uploadQueue.addFiles(files)
    if (files.length > 1) showToast(`${files.length} works queued`)
  }, [user, uploadQueue, showToast])

  const handleUpdate = useCallback((id: string, updates: Partial<Artwork>) => {
    setArtworks(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
    if (selected?.id === id) {
      setSelected(prev => prev ? { ...prev, ...updates } : null)
    }
  }, [selected])

  const handleDelete = useCallback((id: string) => {
    setArtworks(prev => prev.filter(a => a.id !== id))
    setSelected(null)
    if (user) deleteArtworkFromDB(id, user.id)
  }, [user])

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    setArtworks([])
    setSelected(null)
  }, [])

  const filtered = artworks.filter(a => {
    if ((a.mediaType ?? 'painting') !== activeTab) return false
    if (filter === 'complete' && a.status !== 'complete') return false
    if (filter === 'pending' && a.status === 'complete') return false
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      return !!(
        a.title?.toLowerCase().includes(q) ||
        a.year?.includes(q) ||
        a.place?.toLowerCase().includes(q) ||
        a.aiAnalysis?.style?.toLowerCase().includes(q) ||
        a.aiAnalysis?.medium?.toLowerCase().includes(q) ||
        a.aiAnalysis?.subject?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const tabArtworks = artworks.filter(a => (a.mediaType ?? 'painting') === activeTab)

  const stats = {
    total: tabArtworks.length,
    complete: tabArtworks.filter(a => a.status === 'complete').length,
    withStory: tabArtworks.filter(a => a.voiceMemo).length,
  }

  return (
    <>
      <main style={{ minHeight: '100vh', background: 'var(--bg)' }}>

        {/* ── Header ── */}
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
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, cursor: 'default' }}>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22, fontWeight: 400, fontStyle: 'italic',
              letterSpacing: '0.01em', color: 'var(--text)',
            }}>
              ArtisTrust
            </h1>
            <span style={{
              fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'var(--accent-dim)', fontFamily: 'var(--font-body)',
            }}>
              Studio
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 28 }}>
              {[
                { label: 'Works',      value: stats.total },
                { label: 'Catalogued', value: stats.complete },
                { label: 'Stories',    value: stats.withStory },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'right' }}>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 22, color: 'var(--accent)', fontWeight: 400,
                  }}>
                    {s.value}
                  </div>
                  <div style={{
                    fontSize: 10, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: 'var(--text-dim)', marginTop: 1,
                  }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Profile + Legal + Sign out */}
            {user && (
              <>
                <div style={{ width: 1, height: 28, background: 'var(--border)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Profile avatar button */}
                  <button
                    onClick={() => setProfileOpen(true)}
                    title="Artist Profile"
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'rgba(201,169,110,0.1)',
                      border: '1px solid var(--accent-dim)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-display)',
                      fontSize: 13, fontStyle: 'italic',
                      color: 'var(--accent)',
                      transition: 'all 0.18s',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(201,169,110,0.2)'
                      e.currentTarget.style.borderColor = 'var(--accent)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(201,169,110,0.1)'
                      e.currentTarget.style.borderColor = 'var(--accent-dim)'
                    }}
                  >
                    {(() => {
                      const meta = user.user_metadata?.full_name as string | undefined
                      return meta
                        ? meta.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
                        : user.email?.[0]?.toUpperCase() ?? '?'
                    })()}
                  </button>
                  <button
                    onClick={() => setLegalOpen(true)}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 2, padding: '5px 14px',
                      color: 'var(--text-dim)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                      cursor: 'pointer', transition: 'all 0.18s',
                      display: 'flex', alignItems: 'center', gap: 7,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--accent-dim)'
                      e.currentTarget.style.color = 'var(--accent)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.color = 'var(--text-dim)'
                    }}
                  >
                    <svg width="10" height="11" viewBox="0 0 10 11" fill="none">
                      <rect x="1" y="1" width="8" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
                      <path d="M3 4h4M3 6.5h4M3 9h2.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
                    </svg>
                    Legal &amp; Estate
                  </button>
                  <button
                    onClick={handleSignOut}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 2, padding: '5px 14px',
                      color: 'var(--text-dim)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                      cursor: 'pointer', transition: 'all 0.18s',
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
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* ── Section tabs ── */}
        <div style={{
          display: 'flex', alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          padding: '0 40px',
          background: 'var(--surface)',
        }}>
          {([
            { key: 'painting',     label: 'Paintings' },
            { key: 'photography',  label: 'Photography' },
          ] as const).map(tab => {
            const count = artworks.filter(a => (a.mediaType ?? 'painting') === tab.key).length
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setFilter('all'); setSearchTerm('') }}
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
                {count > 0 && (
                  <span style={{
                    fontSize: 10,
                    background: isActive ? 'rgba(201,169,110,0.15)' : 'rgba(255,255,255,0.06)',
                    borderRadius: 100,
                    padding: '2px 7px',
                    color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                    fontWeight: 500,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Page content ── */}
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '36px 40px 80px' }}>

          {/* Drop zone */}
          <div style={{ marginBottom: 32 }}>
            <DropZone
              onFiles={handleFiles}
              label={activeTab === 'photography' ? 'Drag photographs & scans here' : 'Drag paintings here'}
            />
          </div>

          {/* Controls */}
          {tabArtworks.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 22, gap: 12, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {/* Search */}
                <div style={{ position: 'relative', width: 240 }}>
                  <svg
                    width="13" height="13" viewBox="0 0 13 13" fill="none"
                    style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', opacity: 0.3, pointerEvents: 'none' }}
                  >
                    <circle cx="5" cy="5" r="4" stroke="#888" strokeWidth="1.1"/>
                    <path d="M8.5 8.5l3 3" stroke="#888" strokeWidth="1.1" strokeLinecap="round"/>
                  </svg>
                  <input
                    type="text"
                    placeholder={`Search ${activeTab === 'photography' ? 'photography' : 'paintings'}…`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px 8px 32px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)', borderRadius: 2,
                      color: 'var(--text)', fontSize: 14,
                      fontFamily: 'var(--font-body)', fontWeight: 300,
                      outline: 'none', transition: 'border-color 0.2s',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                  />
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {(['all', 'complete', 'pending'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        background: filter === f ? 'var(--accent)' : 'transparent',
                        border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 2,
                        padding: '5px 13px',
                        color: filter === f ? '#0a0a0a' : 'var(--text-dim)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 11, fontWeight: 500,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        cursor: 'pointer',
                        transition: 'all 0.18s',
                      }}
                      onMouseEnter={e => {
                        if (filter !== f) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--muted)'
                      }}
                      onMouseLeave={e => {
                        if (filter !== f) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                      }}
                    >
                      {f === 'all' ? 'All' : f === 'complete' ? 'Catalogued' : 'Pending'}
                    </button>
                  ))}
                </div>
              </div>

              <span style={{
                fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.06em',
              }}>
                {filtered.length} {filtered.length === 1 ? 'work' : 'works'}
              </span>
            </div>
          )}

          {/* Grid */}
          {filtered.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))',
              gap: 18,
            }}>
              {filtered.map(artwork => (
                <ArtworkCard
                  key={artwork.id}
                  artwork={artwork}
                  onClick={() => setSelected(artwork)}
                />
              ))}
            </div>
          ) : tabArtworks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0 40px' }}>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20, fontStyle: 'italic', fontWeight: 400,
                color: 'var(--muted)', marginBottom: 8,
              }}>
                {activeTab === 'photography' ? 'Your photography archive awaits' : 'Your catalogue awaits'}
              </p>
              <small style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13, color: 'var(--muted)', letterSpacing: '0.06em',
              }}>
                {activeTab === 'photography'
                  ? 'Drag scanned film, slides, or photographs above to begin'
                  : 'Drag photographs of your works above to begin'}
              </small>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: 17, fontStyle: 'italic', color: 'var(--muted)',
              }}>
                No works match your search
              </p>
            </div>
          )}
        </div>

        {/* Modal */}
        {selected && (
          <ArtworkModal
            artwork={selected}
            onClose={() => setSelected(null)}
            onUpdate={(updates) => handleUpdate(selected.id, updates)}
            onDelete={() => handleDelete(selected.id)}
            onSaved={() => showToast('Saved to catalogue')}
          />
        )}

        {/* Toast */}
        <div className={`toast${toast ? ' show' : ''}`}>
          ✓&nbsp;&nbsp;{toast}
        </div>

      </main>

      {/* Legal Modal */}
      {legalOpen && user && (
        <LegalModal
          userId={user.id}
          onClose={() => setLegalOpen(false)}
          onSaved={() => showToast('Legal settings saved')}
        />
      )}

      {/* Profile Modal */}
      {profileOpen && user && (
        <ProfileModal
          userId={user.id}
          userEmail={user.email ?? ''}
          onClose={() => setProfileOpen(false)}
          onSaved={() => showToast('Profile saved')}
        />
      )}

      {/* Upload queue progress drawer */}
      <QueueDrawer
        items={uploadQueue.items}
        stats={uploadQueue.stats}
        isPaused={uploadQueue.isPaused}
        isVisible={uploadQueue.isVisible}
        onPause={uploadQueue.pause}
        onResume={uploadQueue.resume}
        onRetryErrors={uploadQueue.retryErrors}
        onClearDone={uploadQueue.clearDone}
        onClose={() => uploadQueue.setVisible(false)}
      />

      {/* Auth gate — shown when not signed in */}
      {mounted && !user && (
        <AuthModal onAuth={() =>
          supabase.auth.getSession().then(({ data }) =>
            setUser(data.session?.user ?? null)
          )
        } />
      )}
    </>
  )
}
