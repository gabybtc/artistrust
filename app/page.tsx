"use client"
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { Artwork, Tab } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { fetchArtworks, upsertArtworks, deleteArtworkFromDB, toggleArtworkPublic, getTabSettings, saveTabSettings, getProfileSettings, DEFAULT_TABS, bulkUpdateArtworks } from '@/lib/db'
import { useSubscription } from '@/lib/useSubscription'
import { generatePdfCatalogue } from '@/lib/pdfCatalogue'
import { planLabel } from '@/lib/plans'
import CopyrightExportModal from './components/CopyrightExportModal'
import PricingModal from './components/PricingModal'
import { useUploadQueue } from '@/lib/useUploadQueue'
import { useUploadDefaults } from '@/lib/useUploadDefaults'
import ArtworkModal from './components/ArtworkModal'
import ArtworkCard from './components/ArtworkCard'
import DropZone from './components/DropZone'
import LegalModal from './components/LegalModal'
import ProfileModal from './components/ProfileModal'
import QueueDrawer from './components/QueueDrawer'
import BulkEditDrawer from './components/BulkEditDrawer'
import ColourClusterView from './components/ColourClusterView'
import UploadDefaultsBar from './components/UploadDefaultsBar'

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [selected, setSelected] = useState<Artwork | null>(null)
  const [tabs, setTabs] = useState<Tab[]>(DEFAULT_TABS)
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_TABS[0].id)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingTabLabel, setEditingTabLabel] = useState('')
  const [filter, setFilter] = useState<'all' | 'complete' | 'pending'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [pricingOpen, setPricingOpen] = useState(false)
  const [pricingLockedFeature, setPricingLockedFeature] = useState<'copyright' | 'exif' | 'portfolio' | 'pdf' | 'upload_limit' | undefined>()
  const [pdfGenerating, setPdfGenerating] = useState(false)

  const openPricing = useCallback((feature?: typeof pricingLockedFeature) => {
    setPricingLockedFeature(feature)
    setPricingOpen(true)
  }, [])

  // Subscription — loads after user is known
  const subscription = useSubscription()
  const [mounted, setMounted] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [legalOpen, setLegalOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [moveToTab, setMoveToTab] = useState<string>('')
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null)
  const [copyrightGenerating, setCopyrightGenerating] = useState(false)
  const [copyrightModalOpen, setCopyrightModalOpen] = useState(false)
  const [copyrightInitialSelected, setCopyrightInitialSelected] = useState<Set<string>>(new Set())
  const [copyrightArtistName, setCopyrightArtistName] = useState<string>('Artist')
  const [overageLoading, setOverageLoading] = useState(false)
  const [overageError, setOverageError] = useState('')
  const [sortBy, setSortBy] = useState<string>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('artistrust_sort') ?? 'uploaded-desc') : 'uploaded-desc'
  )
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'grid' | 'cluster'>('grid')
  const [profileFullName, setProfileFullName] = useState<string | undefined>(undefined)
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false)
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  // Auth: detect session on mount and watch for changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setMounted(true)
    })
    // Handle post-Stripe redirect success params
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('billing') === 'success') {
        showToast('Plan upgraded successfully!')
        window.history.replaceState({}, '', '/')
      }
      if (params.get('emailVerified') === 'true') {
        setEmailVerified(true)
        showToast('Email verified — thank you!')
        window.history.replaceState({}, '', '/')
      }
      if (params.get('card') === 'saved') {
        showToast('Card saved — you can now upload beyond your monthly limit.')
        window.history.replaceState({}, '', '/')
      }
      if (params.get('passwordReset') === 'success') {
        showToast('Password updated successfully.')
        window.history.replaceState({}, '', '/')
      }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Handle auth-gating and ?plan= intent
  useEffect(() => {
    if (!mounted) return
    if (!user) {
      const params = new URLSearchParams(window.location.search)
      const plan = params.get('plan')
      const interval = params.get('interval')
      if (plan === 'studio' || plan === 'archive') {
        const q = new URLSearchParams({ plan, ...(interval ? { interval } : {}) })
        router.push('/signup?' + q.toString())
      } else {
        router.push('/login')
      }
    } else {
      // Logged-in user arriving with ?plan= from marketing site — open PricingModal
      const params = new URLSearchParams(window.location.search)
      const plan = params.get('plan')
      const interval = params.get('interval')
      if (plan === 'studio' || plan === 'archive') {
        window.history.replaceState({}, '', '/')
        if (interval === 'monthly' || interval === 'annual') {
          // email confirmation flow: plan+interval both known, go straight to Stripe
          subscription.openCheckout(plan, interval)
            .catch(() => setPricingOpen(true))
        } else {
          setPricingOpen(true)
        }
      }
    }
  }, [mounted, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load artworks from DB when user signs in; clear when signed out.
  // Reset any artworks stuck in transient upload/analysis states from a
  // previous session — these states only exist while the app is actively
  // processing and should never persist across page reloads.
  useEffect(() => {
    if (!user) { setArtworks([]); return }
    fetchArtworks(user.id).then(artworks => {
      const fixed = artworks.map(a =>
        (a.status === 'analyzing' || a.status === 'uploading')
          ? { ...a, status: 'ready' as const }
          : a
      )
      setArtworks(fixed)
    })
    getTabSettings(user.id).then(saved => {
      if (saved) {
        setTabs(saved)
        setActiveTab(saved[0].id)
      }
    })
    getProfileSettings(user.id).then(profile => {
      if (profile?.fullName) setProfileFullName(profile.fullName)
      setEmailVerified(profile?.emailVerified === true)
    })
  }, [user])

  // Debounced sync to DB — only persists artworks that have a real URL (not temp base64)
  useEffect(() => {
    if (!user || !mounted) return
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      upsertArtworks(artworks, user.id)
    }, 1500)
  }, [artworks, user, mounted])

  const sendVerifyEmail = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return
    await fetch('/api/email/verify-send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    })
  }, [])

  const resendVerification = useCallback(async () => {
    if (!user?.email || resendState !== 'idle') return
    setResendState('sending')
    await sendVerifyEmail()
    setResendState('sent')
  }, [user, resendState, sendVerifyEmail])

  // Auto-send the verification email once when an unverified user first reaches
  // the dashboard. Uses localStorage to avoid sending on every page reload.
  useEffect(() => {
    if (!user || emailVerified !== false) return
    const key = `at_verify_sent_${user.id}`
    if (typeof window !== 'undefined' && !localStorage.getItem(key)) {
      localStorage.setItem(key, '1')
      sendVerifyEmail().catch(() => { /* non-critical */ })
    }
  }, [user, emailVerified, sendVerifyEmail])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }, [])

  // ── Upload defaults — sticky per-field values for new uploads ────────────
  const uploadDefaults = useUploadDefaults({ profileFullName })

  // ── Upload queue — handles unlimited files, folders, background processing ──
  const onArtworkAdded = useCallback((artwork: Artwork) => {
    setArtworks(prev => [artwork, ...prev])
  }, [])

  const onArtworkUpdated = useCallback((id: string, updates: Partial<Artwork>) => {
    setArtworks(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
  }, [])

  const monthlyUploadsUsed = useMemo(() => {
    const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
    return artworks.filter(a => new Date(a.uploadedAt) >= start).length
  }, [artworks])

  const uploadQueue = useUploadQueue({
    userId: user?.id ?? null,
    activeTab,
    onArtworkAdded,
    onArtworkUpdated,
    defaults: uploadDefaults.defaults,
    monthlyUploadsUsed,
    monthlyUploadLimit: subscription.monthlyUploadLimit,
    onPlanLimit: () => openPricing('upload_limit'),
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

  const handleTogglePublic = useCallback((id: string, isPublic: boolean) => {
    setArtworks(prev => prev.map(a => a.id === id ? { ...a, isPublic } : a))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, isPublic } : null)
    if (user) toggleArtworkPublic(id, user.id, isPublic)
  }, [user, selected])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  // selectAll is defined after tagFiltered (below)

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds)
    setArtworks(prev => prev.filter(a => !selectedIds.has(a.id)))
    setSelected(prev => (prev && selectedIds.has(prev.id) ? null : prev))
    if (user) ids.forEach(id => deleteArtworkFromDB(id, user.id))
    setSelectedIds(new Set())
    showToast(`${ids.length} ${ids.length === 1 ? 'work' : 'works'} deleted`)
  }, [selectedIds, user, showToast])

  const handleCopyrightExport = useCallback(async (artworksToExport: Artwork[]) => {
    if (!user || copyrightGenerating) return
    setCopyrightGenerating(true)
    try {
      const profile = await getProfileSettings(user.id)
      const name = profile?.fullName
        || (user.user_metadata?.full_name as string | undefined)
        || user.email
        || 'Artist'
      setCopyrightArtistName(name)
      setCopyrightInitialSelected(new Set(artworksToExport.map(a => a.id)))
      setCopyrightModalOpen(true)
    } finally {
      setCopyrightGenerating(false)
    }
  }, [user, copyrightGenerating])

  const handlePdfExport = useCallback(async () => {
    if (!user || pdfGenerating) return
    setPdfGenerating(true)
    try {
      const profile = await getProfileSettings(user.id)
      const blob = await generatePdfCatalogue(artworks, profile)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(profile?.fullName ?? 'archive').replace(/\s+/g, '-').toLowerCase()}-catalog.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setPdfGenerating(false)
    }
  }, [user, artworks, pdfGenerating])

  const handleBulkMove = useCallback((targetTabId: string) => {
    const ids = Array.from(selectedIds)
    setArtworks(prev =>
      prev.map(a => selectedIds.has(a.id) ? { ...a, mediaType: targetTabId } : a)
    )
    if (user) setArtworks(prev => { upsertArtworks(prev, user.id); return prev })
    setSelectedIds(new Set())
    const label = tabs.find(t => t.id === targetTabId)?.label ?? targetTabId
    showToast(`${ids.length} ${ids.length === 1 ? 'work' : 'works'} moved to ${label}`)
  }, [selectedIds, user, tabs, showToast])

  const handleBulkEdit = useCallback((patch: Partial<Artwork>) => {
    const ids = Array.from(selectedIds)
    setArtworks(prev => prev.map(a => selectedIds.has(a.id) ? { ...a, ...patch } : a))
    if (user) bulkUpdateArtworks(ids, patch, user.id)
    setSelectedIds(new Set())
    setBulkEditOpen(false)
    showToast(`${ids.length} ${ids.length === 1 ? 'work' : 'works'} updated`)
  }, [selectedIds, user, showToast])

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    setArtworks([])
    setSelected(null)
    setTabs(DEFAULT_TABS)
    setActiveTab(DEFAULT_TABS[0].id)
  }, [])

  // ── Tab management ────────────────────────────────────────────────────────
  const commitTabRename = useCallback((id: string, newLabel: string) => {
    const trimmed = newLabel.trim()
    if (!trimmed) { setEditingTabId(null); return }
    setTabs(prev => {
      const next = prev.map(t => t.id === id ? { ...t, label: trimmed } : t)
      if (user) saveTabSettings(user.id, next)
      return next
    })
    setEditingTabId(null)
  }, [user])

  const handleAddTab = useCallback(() => {
    const id = `tab-${Date.now()}`
    const newTab: Tab = { id, label: 'New Tab' }
    setTabs(prev => {
      const next = [...prev, newTab]
      if (user) saveTabSettings(user.id, next)
      return next
    })
    setActiveTab(id)
    setFilter('all')
    setSearchTerm('')
    setActiveTags(new Set())
    setEditingTabLabel('New Tab')
    setEditingTabId(id)
  }, [user])

  const handleDeleteTab = useCallback((id: string) => {
    setTabs(prev => {
      if (prev.length <= 1) return prev
      const next = prev.filter(t => t.id !== id)
      if (user) saveTabSettings(user.id, next)
      return next
    })
    setActiveTab(prev => {
      if (prev !== id) return prev
      const remaining = tabs.filter(t => t.id !== id)
      return remaining[0]?.id ?? DEFAULT_TABS[0].id
    })
  }, [user, tabs])

  const filtered = artworks.filter(a => {
    if ((a.mediaType ?? tabs[0].id) !== activeTab) return false
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
        a.aiAnalysis?.subject?.toLowerCase().includes(q) ||
        a.tags?.some(t => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  const sorted = useMemo(() => {
    const arr = [...filtered]
    switch (sortBy) {
      case 'year-asc':    return arr.sort((a, b) => (a.year || '0').localeCompare(b.year || '0'))
      case 'year-desc':   return arr.sort((a, b) => (b.year || '0').localeCompare(a.year || '0'))
      case 'title-asc':   return arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      case 'title-desc':  return arr.sort((a, b) => (b.title || '').localeCompare(a.title || ''))
      case 'medium':      return arr.sort((a, b) => (a.material || '').localeCompare(b.material || ''))
      default:            return arr // uploaded-desc (already ordered by fetchArtworks)
    }
  }, [filtered, sortBy])

  // Tag filter strip — top 30 tags by frequency across sorted artworks
  const availableTags = useMemo(() => {
    const freq = new Map<string, number>()
    for (const a of sorted) {
      for (const t of a.tags ?? []) {
        freq.set(t, (freq.get(t) ?? 0) + 1)
      }
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([tag]) => tag)
  }, [sorted])

  const tagFiltered = useMemo(() =>
    activeTags.size === 0
      ? sorted
      : sorted.filter(a => [...activeTags].every(t => a.tags?.includes(t)))
  , [sorted, activeTags])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(tagFiltered.map(a => a.id)))
  }, [tagFiltered])

  const tabArtworks = artworks.filter(a => (a.mediaType ?? tabs[0].id) === activeTab)

  const stats = {
    total: tabArtworks.length,
    complete: tabArtworks.filter(a => a.status === 'complete').length,
    withStory: tabArtworks.filter(a => a.voiceMemo).length,
  }

  // Derive unique suggestion lists from the full catalogue — used by SmartInput
  // fields in ArtworkModal and BulkEditDrawer. Sorted and deduped, empty strings excluded.
  const suggestions = {
    years:     [...new Set(artworks.map(a => a.year).filter(Boolean))].sort().reverse(),
    places:    [...new Set(artworks.map(a => a.place).filter(Boolean))].sort(),
    locations: [...new Set(artworks.map(a => a.location).filter(Boolean))].sort(),
    materials: [...new Set(artworks.map(a => a.material).filter(Boolean))].sort(),
    series:    [...new Set(artworks.map(a => a.series).filter((s): s is string => !!s))].sort(),
    allTags:   [...new Set(artworks.flatMap(a => a.tags ?? []))].sort(),
  }

  const showVerifyBanner = !!user && emailVerified === false && !verifyBannerDismissed

  return (
    <>
      <main style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 44 }}>

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
            <h1 className="glow-accent" style={{
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
                { label: 'Cataloged', value: stats.complete },
                { label: 'Stories',    value: stats.withStory },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'right' }}>
                  <div className="glow-stat" style={{
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
                    onClick={() => handleCopyrightExport(artworks)}
                    disabled={copyrightGenerating || artworks.length === 0}
                    title="Download copyright registration package"
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: 2, padding: '5px 14px',
                      color: copyrightGenerating ? 'var(--accent)' : 'var(--text-dim)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                      cursor: copyrightGenerating || artworks.length === 0 ? 'default' : 'pointer',
                      transition: 'all 0.18s',
                      display: 'flex', alignItems: 'center', gap: 7,
                      opacity: artworks.length === 0 ? 0.4 : 1,
                    }}
                    onMouseEnter={e => {
                      if (copyrightGenerating || artworks.length === 0) return
                      e.currentTarget.style.borderColor = 'var(--accent-dim)'
                      e.currentTarget.style.color = 'var(--accent)'
                    }}
                    onMouseLeave={e => {
                      if (copyrightGenerating) return
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.color = 'var(--text-dim)'
                    }}
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1"/>
                      <path d="M7 4.2C6.6 3.7 6.1 3.4 5.5 3.4c-1.2 0-2.1 1-2.1 2.1s.9 2.1 2.1 2.1c.6 0 1.1-.3 1.5-.8" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
                    </svg>
                    {copyrightGenerating ? 'Generating…' : 'Copyright'}
                  </button>
                  {subscription.canExportPdf && (
                    <button
                      onClick={handlePdfExport}
                      disabled={pdfGenerating || artworks.length === 0}
                      title="Export PDF catalog"
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: 2, padding: '5px 14px',
                        color: pdfGenerating ? 'var(--accent)' : 'var(--text-dim)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                        cursor: pdfGenerating || artworks.length === 0 ? 'default' : 'pointer',
                        transition: 'all 0.18s',
                        opacity: artworks.length === 0 ? 0.4 : 1,
                      }}
                      onMouseEnter={e => {
                        if (pdfGenerating || artworks.length === 0) return
                        e.currentTarget.style.borderColor = 'var(--accent-dim)'
                        e.currentTarget.style.color = 'var(--accent)'
                      }}
                      onMouseLeave={e => {
                        if (pdfGenerating) return
                        e.currentTarget.style.borderColor = 'var(--border)'
                        e.currentTarget.style.color = 'var(--text-dim)'
                      }}
                    >
                      {pdfGenerating ? 'Generating…' : 'PDF Catalog'}
                    </button>
                  )}
                  {!subscription.loading && process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true' && (
                    subscription.subscription?.isBeta ? (
                      <span style={{
                        border: '1px solid var(--accent-dim)',
                        borderRadius: 2, padding: '4px 10px',
                        fontFamily: 'var(--font-body)',
                        fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                        color: 'var(--accent)',
                      }}>
                        Beta Tester
                      </span>
                    ) : (
                      <button
                        onClick={() => openPricing()}
                        title="View plans & upgrade"
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: 2, padding: '4px 10px',
                          fontFamily: 'var(--font-body)',
                          fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
                          color: 'var(--text-dim)',
                          cursor: 'pointer', transition: 'all 0.18s',
                          display: 'flex', alignItems: 'center', gap: 5,
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
                        {planLabel(subscription.subscription?.plan ?? 'preserve')}
                        <span style={{ opacity: 0.45 }}>·</span>
                        <span style={{ color: 'var(--accent-dim)' }}>Plans</span>
                      </button>
                    )
                  )}
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

        {/* ── Email verification banner ── */}
        {showVerifyBanner && (
          <div style={{
            position: 'sticky', top: 62, zIndex: 39,
            background: 'rgba(18,14,8,0.97)',
            borderBottom: '1px solid rgba(201,169,110,0.25)',
            padding: '9px 40px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            backdropFilter: 'blur(8px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="3" width="12" height="8" rx="1.5" stroke="rgba(201,169,110,0.7)" strokeWidth="1.1"/>
                <path d="M1 4.5l6 4 6-4" stroke="rgba(201,169,110,0.7)" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
              <span style={{
                fontFamily: 'var(--font-body)', fontSize: 12,
                color: 'rgba(201,169,110,0.8)', letterSpacing: '0.03em',
              }}>
                Please verify your email address to unlock all features.
              </span>
              <button
                onClick={resendVerification}
                disabled={resendState !== 'idle'}
                style={{
                  background: 'none', border: 'none', cursor: resendState === 'idle' ? 'pointer' : 'default',
                  fontFamily: 'var(--font-body)', fontSize: 12,
                  color: resendState === 'sent' ? 'var(--accent)' : 'var(--accent-dim)',
                  letterSpacing: '0.06em', padding: 0,
                  textDecoration: resendState === 'idle' ? 'underline' : 'none',
                  transition: 'color 0.15s',
                }}
              >
                {resendState === 'sending' ? 'Sending…' : resendState === 'sent' ? '✓ Link sent' : 'Resend link'}
              </button>
            </div>
            <button
              onClick={() => setVerifyBannerDismissed(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', padding: '2px 4px',
                fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1,
                flexShrink: 0,
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Section tabs ── */}
        <div style={{
          display: 'flex', alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          padding: '0 40px',
          background: 'var(--surface)',
        }}>
          {tabs.map(tab => {
            const count = artworks.filter(a => (a.mediaType ?? tabs[0].id) === tab.id).length
            const isActive = activeTab === tab.id
            return (
              <div
                key={tab.id}
                style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                onMouseEnter={() => setHoveredTabId(tab.id)}
                onMouseLeave={() => setHoveredTabId(null)}
              >
                {editingTabId === tab.id ? (
                  <input
                    autoFocus
                    value={editingTabLabel}
                    onChange={e => setEditingTabLabel(e.target.value)}
                    onBlur={() => commitTabRename(tab.id, editingTabLabel)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitTabRename(tab.id, editingTabLabel)
                      if (e.key === 'Escape') setEditingTabId(null)
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--accent)',
                      outline: 'none',
                      fontFamily: 'var(--font-body)',
                      fontSize: 12,
                      fontWeight: 400,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--text)',
                      padding: '14px 4px 12px',
                      width: Math.max(80, editingTabLabel.length * 9),
                      marginBottom: -1,
                    }}
                  />
                ) : (
                  <button
                    onClick={() => { setActiveTab(tab.id); setFilter('all'); setSearchTerm(''); setActiveTags(new Set()) }}
                    onDoubleClick={() => { setEditingTabLabel(tab.label); setEditingTabId(tab.id) }}
                    title="Double-click to rename"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-body)', fontSize: 12,
                      fontWeight: 400, letterSpacing: '0.14em', textTransform: 'uppercase',
                      color: isActive ? 'var(--text)' : 'var(--text-dim)',
                      padding: '14px 20px 12px 24px',
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
                )}

                {/* Inline rename icon (hover on active tab) */}
                {!editingTabId && isActive && (
                  <button
                    onClick={() => { setEditingTabLabel(tab.label); setEditingTabId(tab.id) }}
                    title="Rename tab"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '0 4px', color: 'var(--text-dim)',
                      display: 'flex', alignItems: 'center',
                      opacity: hoveredTabId === tab.id ? 1 : 0, transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M7.5 1.5l2 2L3 10H1V8L7.5 1.5z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}

                {/* Delete tab button (hover, only when >1 tab) */}
                {tabs.length > 1 && !editingTabId && (
                  <button
                    onClick={() => handleDeleteTab(tab.id)}
                    title="Delete tab"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '0 2px', color: 'var(--text-dim)',
                      display: 'flex', alignItems: 'center',
                      opacity: hoveredTabId === tab.id ? 1 : 0, transition: 'opacity 0.15s',
                      fontSize: 14, lineHeight: 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#e05a5a')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}

          {/* Add tab button */}
          <button
            onClick={handleAddTab}
            title="Add a new tab"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)',
              fontSize: 18, lineHeight: 1,
              padding: '10px 12px',
              display: 'flex', alignItems: 'center',
              transition: 'color 0.18s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
          >
            +
          </button>
        </div>

        {/* ── Page content ── */}
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '36px 40px 80px' }}>

          {/* Drop zone */}
          <div style={{ marginBottom: 32 }}>
            {user && (
              <UploadDefaultsBar
                defaults={uploadDefaults.defaults}
                suggestions={suggestions}
                onSet={uploadDefaults.setDefault}
                onClear={uploadDefaults.clearDefault}
              />
            )}
            <DropZone
              onFiles={handleFiles}
              label={activeTab === 'photography' ? 'Drag photographs & scans here' : `Drag ${tabs.find(t => t.id === activeTab)?.label.toLowerCase() ?? 'works'} here`}
              uploadCaption={(() => {
                const used = artworks.filter(a => {
                  const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
                  return new Date(a.uploadedAt) >= start
                }).length
                const limit = subscription.monthlyUploadLimit
                if (limit === null || limit === undefined) return 'Unlimited uploads'
                return `${used} / ${limit} uploads this month`
              })()}
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
                      {f === 'all' ? 'All' : f === 'complete' ? 'Cataloged' : 'Pending'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Sort — only shown at 10+ works */}
                {tabArtworks.length >= 10 && (
                  <select
                    value={sortBy}
                    onChange={e => {
                      setSortBy(e.target.value)
                      localStorage.setItem('artistrust_sort', e.target.value)
                    }}
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 2, padding: '5px 28px 5px 10px',
                      color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
                      fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
                      outline: 'none',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23555' strokeWidth='1.2' fill='none' strokeLinecap='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 8px center',
                    }}
                  >
                    <option value="uploaded-desc">Newest first</option>
                    <option value="year-desc">Year ↓</option>
                    <option value="year-asc">Year ↑</option>
                    <option value="title-asc">Title A–Z</option>
                    <option value="title-desc">Title Z–A</option>
                    <option value="medium">By medium</option>
                  </select>
                )}

                <span style={{
                  fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.06em',
                }}>
                  {tagFiltered.length} {tagFiltered.length === 1 ? 'work' : 'works'}
                </span>

                {user && tagFiltered.length > 0 && (
                  <button
                    onClick={selectedIds.size === tagFiltered.length ? clearSelection : selectAll}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '0 2px',
                      color: 'var(--text-dim)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 11, letterSpacing: '0.08em',
                      cursor: 'pointer', transition: 'color 0.15s',
                      textDecoration: 'underline', textUnderlineOffset: 3,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                  >
                    {selectedIds.size === tagFiltered.length ? 'Deselect all' : 'Select all'}
                  </button>
                )}

                {/* View mode toggle — grid / color wheel */}
                {tabArtworks.length > 0 && (
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button
                      key="grid"
                      title="Grid view"
                      onClick={() => setViewMode('grid')}
                      style={{
                        height: 28,
                        paddingInline: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: viewMode === 'grid' ? 'rgba(201,169,110,0.1)' : 'transparent',
                        border: `1px solid ${viewMode === 'grid' ? 'var(--accent-dim)' : 'var(--border)'}`,
                        borderRadius: 2, cursor: 'pointer',
                        color: viewMode === 'grid' ? 'var(--accent)' : 'var(--text-dim)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <rect x="0.5" y="0.5" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1"/>
                        <rect x="7" y="0.5" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1"/>
                        <rect x="0.5" y="7" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1"/>
                        <rect x="7" y="7" width="4.5" height="4.5" stroke="currentColor" strokeWidth="1"/>
                      </svg>
                    </button>
                    <button
                      key="cluster"
                      title="View your works arranged by color"
                      onClick={() => setViewMode('cluster')}
                      style={{
                        height: 28,
                        paddingInline: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        background: viewMode === 'cluster' ? 'rgba(201,169,110,0.1)' : 'rgba(201,169,110,0.04)',
                        border: `1px solid ${viewMode === 'cluster' ? 'var(--accent)' : 'var(--accent-dim)'}`,
                        borderRadius: 2, cursor: 'pointer',
                        color: viewMode === 'cluster' ? 'var(--accent)' : 'var(--accent-dim)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (viewMode !== 'cluster') {
                          e.currentTarget.style.background = 'rgba(201,169,110,0.1)'
                          e.currentTarget.style.color = 'var(--accent)'
                          e.currentTarget.style.borderColor = 'var(--accent)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (viewMode !== 'cluster') {
                          e.currentTarget.style.background = 'rgba(201,169,110,0.04)'
                          e.currentTarget.style.color = 'var(--accent-dim)'
                          e.currentTarget.style.borderColor = 'var(--accent-dim)'
                        }
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1"/>
                        <circle cx="6.5" cy="6.5" r="2" fill="currentColor" opacity="0.3"/>
                        <line x1="6.5" y1="1" x2="6.5" y2="4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                        <line x1="11" y1="8.5" x2="8.4" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                        <line x1="2" y1="8.5" x2="4.6" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                      </svg>
                      Color Wheel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bulk selection toolbar */}
          {selectedIds.size > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              marginBottom: 18,
              padding: '10px 16px',
              background: 'rgba(201,169,110,0.07)',
              border: '1px solid var(--accent-dim)',
              borderRadius: 3,
            }}>
              <span style={{
                fontSize: 13, color: 'var(--accent)',
                fontFamily: 'var(--font-body)', letterSpacing: '0.04em',
              }}>
                {selectedIds.size} selected
              </span>

              <button
                onClick={selectedIds.size === tagFiltered.length ? clearSelection : selectAll}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 2, padding: '4px 11px',
                  color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
                  fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                {selectedIds.size === tagFiltered.length ? 'Deselect all' : 'Select all'}
              </button>

              <div style={{ flex: 1 }} />

              {/* Move to tab */}
              {tabs.length > 1 && (
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Move to
                  </span>
                  <select
                    value={moveToTab}
                    onChange={e => {
                      const t = e.target.value
                      if (!t) return
                      setMoveToTab('')
                      handleBulkMove(t)
                    }}
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 2, padding: '5px 10px',
                      color: 'var(--text)', fontFamily: 'var(--font-body)',
                      fontSize: 11, letterSpacing: '0.08em', cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="">— pick tab —</option>
                    {tabs.filter(t => t.id !== activeTab).map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={() => setBulkEditOpen(true)}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 2, padding: '5px 14px',
                  color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
                  fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                  cursor: 'pointer', transition: 'all 0.18s',
                  display: 'flex', alignItems: 'center', gap: 6,
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
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M1 8.5V10h1.5l5-5L6 3.5l-5 5zM9.85 2.15a1 1 0 000-1.42L8.7.57a1 1 0 00-1.42 0L6.3 1.5 8.8 4l1.05-1.05" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Edit
              </button>

              <button
                onClick={() => handleCopyrightExport(artworks.filter(a => selectedIds.has(a.id)))}
                disabled={copyrightGenerating}
                style={{
                  background: 'transparent', border: '1px solid var(--accent-dim)',
                  borderRadius: 2, padding: '5px 14px',
                  color: copyrightGenerating ? 'var(--accent)' : 'var(--accent)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                  cursor: copyrightGenerating ? 'default' : 'pointer',
                  transition: 'all 0.18s',
                  display: 'flex', alignItems: 'center', gap: 6,
                  opacity: copyrightGenerating ? 0.6 : 1,
                }}
                onMouseEnter={e => {
                  if (copyrightGenerating) return
                  e.currentTarget.style.background = 'rgba(201,169,110,0.12)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1"/>
                  <path d="M7 4.2C6.6 3.7 6.1 3.4 5.5 3.4c-1.2 0-2.1 1-2.1 2.1s.9 2.1 2.1 2.1c.6 0 1.1-.3 1.5-.8" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
                </svg>
                {copyrightGenerating ? 'Generating…' : 'Export'}
              </button>

              <button
                onClick={handleBulkDelete}
                style={{
                  background: 'transparent', border: '1px solid #e05a5a',
                  borderRadius: 2, padding: '5px 16px',
                  color: '#e05a5a', fontFamily: 'var(--font-body)',
                  fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                  cursor: 'pointer', transition: 'all 0.18s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(224,90,90,0.1)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <svg width="11" height="12" viewBox="0 0 11 12" fill="none">
                  <path d="M1 3h9M4 3V2h3v1M2 3l.6 7.5A1 1 0 003.6 11h3.8a1 1 0 001-.95L9 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Delete
              </button>

              <button
                onClick={clearSelection}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 2, padding: '5px 11px',
                  color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
                  fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Tag filter strip — appears when any tags exist in this view */}
          {availableTags.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              overflowX: 'auto', paddingBottom: 2,
              marginBottom: 18,
              scrollbarWidth: 'none',
            }}>
              {activeTags.size > 0 && (
                <button
                  onClick={() => setActiveTags(new Set())}
                  style={{
                    flexShrink: 0,
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: 2, padding: '4px 10px',
                    color: 'var(--text-dim)', fontFamily: 'var(--font-body)',
                    fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  Clear
                </button>
              )}
              {availableTags.map(tag => {
                const ns = tag.split(':')[0]
                const val = tag.slice(tag.indexOf(':') + 1)
                const nsColors: Record<string, string> = {
                  medium: 'var(--accent)', subject: '#7eb8ff', content: '#aaaaaa',
                  mood: '#c9a896', style: '#8ecfb0', color: '#b8a9ff',
                  camera: 'var(--text-dim)', lens: 'var(--text-dim)', aperture: 'var(--text-dim)',
                }
                const color = nsColors[ns] ?? '#aaaaaa'
                const isActive = activeTags.has(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => setActiveTags(prev => {
                      const next = new Set(prev)
                      isActive ? next.delete(tag) : next.add(tag)
                      return next
                    })}
                    style={{
                      flexShrink: 0,
                      background: isActive ? `color-mix(in srgb, ${color} 15%, transparent)` : 'transparent',
                      border: `1px solid ${isActive ? `color-mix(in srgb, ${color} 40%, transparent)` : 'var(--border)'}`,
                      borderRadius: 2, padding: '4px 10px',
                      color: isActive ? color : 'var(--text-dim)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 11, letterSpacing: '0.04em',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ opacity: 0.55, marginRight: 3, fontSize: 10 }}>{ns}</span>{val}
                  </button>
                )
              })}
            </div>
          )}

          {/* Grid / Cluster */}
          {viewMode === 'cluster' ? (
            <ColourClusterView artworks={tagFiltered} onSelect={setSelected} onUpdate={handleUpdate} />
          ) : tagFiltered.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))',
              gap: 18,
            }}>
              {tagFiltered.map(artwork => (
                <ArtworkCard
                  key={artwork.id}
                  artwork={artwork}
                  onClick={() => setSelected(artwork)}
                  selectionMode={selectedIds.size > 0}
                  isSelected={selectedIds.has(artwork.id)}
                  onSelect={toggleSelect}
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
                {`Your ${tabs.find(t => t.id === activeTab)?.label.toLowerCase() ?? 'catalog'} awaits`}
              </p>
              <small style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13, color: 'var(--muted)', letterSpacing: '0.06em',
              }}>
                Drag files above to begin
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
            tabs={tabs}
            suggestions={suggestions}
            onClose={() => setSelected(null)}
            onUpdate={(updates) => handleUpdate(selected.id, updates)}
            onDelete={() => handleDelete(selected.id)}
            onSaved={() => showToast('Saved to catalog')}
            onTogglePublic={(isPublic) => handleTogglePublic(selected.id, isPublic)}
            onSetDefault={uploadDefaults.setDefault}
            canShareWork={subscription.canShareWork}
            onUpgradeClick={() => openPricing('portfolio')}
          />
        )}

        {/* Toast */}
        <div className={`toast${toast ? ' show' : ''}`}>
          ✓&nbsp;&nbsp;{toast}
        </div>

        <footer style={{ textAlign: 'center', padding: '16px 0 8px', fontSize: 12, color: 'var(--muted, #888)' }}>
          &copy; 2026 Wibbly Works Inc. All rights reserved.
        </footer>

      </main>

      {/* Copyright Export Modal */}
      {copyrightModalOpen && (
        <CopyrightExportModal
          artworks={artworks}
          tabs={tabs}
          initialSelected={copyrightInitialSelected}
          artistName={copyrightArtistName}
          onClose={() => setCopyrightModalOpen(false)}
          plan={subscription.subscription?.plan ?? 'preserve'}
          onUpgradeClick={() => openPricing('copyright')}
        />
      )}

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
          onSignOut={() => { setUser(null); setProfileOpen(false) }}
          subscription={subscription.subscription}
          monthlyUploadsUsed={monthlyUploadsUsed}
          onOpenPricing={() => { setProfileOpen(false); openPricing() }}
        />
      )}

      {/* Bulk edit drawer */}
      {bulkEditOpen && selectedIds.size > 0 && (
        <BulkEditDrawer
          selectedArtworks={artworks.filter(a => selectedIds.has(a.id))}
          suggestions={suggestions}
          onApply={handleBulkEdit}
          onClose={() => setBulkEditOpen(false)}
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

      {/* Data trust footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 10,
        height: 36,
        background: 'rgba(10,10,10,0.97)',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 24,
        pointerEvents: 'none',
      }}>
        {[
          {
            text: 'Encrypted at rest & in transit',
            icon: (
              <svg width="10" height="11" viewBox="0 0 10 11" fill="none">
                <rect x="1" y="4.5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="0.9"/>
                <path d="M3 4.5V3a2 2 0 014 0v1.5" stroke="currentColor" strokeWidth="0.9"/>
              </svg>
            ),
          },
          {
            text: 'Stored on AWS S3 · US infrastructure',
            icon: (
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                <path d="M1 7c0-1.1.9-2 2-2h.2A3 3 0 019.8 5H10a2 2 0 010 4H3a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="0.9"/>
              </svg>
            ),
          },
          {
            text: 'Your work, your rights — we claim nothing',
            icon: (
              <svg width="11" height="10" viewBox="0 0 11 10" fill="none">
                <path d="M5.5 1l1.1 2.3 2.5.4-1.8 1.7.4 2.5L5.5 6.8 3.3 7.9l.4-2.5L2 3.7l2.5-.4z" stroke="currentColor" strokeWidth="0.85" strokeLinejoin="round"/>
              </svg>
            ),
          },
        ].map(({ icon, text }, i) => (
          <span key={i} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 10, letterSpacing: '0.07em',
            color: 'var(--muted)', fontFamily: 'var(--font-body)',
          }}>
            <span style={{ color: 'var(--accent-dim)', display: 'flex', alignItems: 'center' }}>
              {icon}
            </span>
            {text}
          </span>
        ))}

        {/* Policy links — pointer events re-enabled just for these */}
        <span style={{ display: 'flex', gap: 14, pointerEvents: 'auto' }}>
          {[['Privacy', '/privacy'], ['Terms', '/terms']].map(([label, href]) => (
            <a
              key={label}
              href={href}
              style={{
                fontSize: 10, letterSpacing: '0.07em',
                color: 'var(--muted)', fontFamily: 'var(--font-body)',
                textDecoration: 'none', transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-dim)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >{label}</a>
          ))}
        </span>
      </div>

      {pricingOpen && process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true' && (
        <PricingModal
          onClose={() => setPricingOpen(false)}
          onUpgrade={(plan, interval) => {
            setPricingOpen(false)
            const label = plan === 'preserve' ? 'Preserve' : plan === 'studio' ? 'Studio' : 'Archive'
            subscription.openCheckout(plan, interval)
              .then(() => showToast(plan === 'preserve' ? 'Downgraded to Preserve — takes effect at period end' : `Upgraded to ${label}`))
              .catch((err: Error) => showToast(err.message))
          }}
          lockedFeature={pricingLockedFeature}
          currentPlan={subscription.subscription?.plan ?? 'preserve'}
          onManageBilling={subscription.subscription?.stripeSubscriptionId ? () => {
            setPricingOpen(false)
            subscription.openPortal().catch((err: Error) => showToast(err.message))
          } : undefined}
        />
      )}

      {/* Overage confirmation dialog */}
      {uploadQueue.pendingOverageCount > 0 && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#1a1a1a', border: '1px solid #333', borderRadius: 14,
            padding: '28px 32px', maxWidth: 420, width: '90%',
          }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 600, color: '#f5f5f5' }}>
              Monthly limit reached
            </h2>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: '#aaa', lineHeight: 1.6 }}>
              {uploadQueue.pendingOverageCount === 1
                ? 'This upload exceeds your monthly limit.'
                : `These ${uploadQueue.pendingOverageCount} uploads exceed your monthly limit.`}{' '}
              {overageError !== 'no_payment_method' && <>
                Your saved card will be charged{' '}
                <strong style={{ color: '#f5f5f5' }}>${uploadQueue.pendingOverageCost.toFixed(2)}</strong>
                {' '}($0.05 per upload, $0.50 minimum).
              </>}
            </p>
            {overageError && (
              <p style={{ margin: '0 0 14px', fontSize: 13, color: '#f87171', lineHeight: 1.5 }}>
                {overageError === 'no_payment_method'
                  ? 'No payment method on file. Add a card to pay $0.05 per upload — no plan upgrade needed.'
                  : overageError === 'payment_requires_action'
                  ? 'Your card requires additional verification. Please update your card via billing settings.'
                  : `Payment failed: ${overageError}`}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { uploadQueue.cancelOverage(); setOverageError('') }}
                disabled={overageLoading}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: '1px solid #444',
                  background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: 13,
                  opacity: overageLoading ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              {overageError === 'no_payment_method' ? (
                <button
                  disabled={overageLoading}
                  onClick={async () => {
                    setOverageLoading(true)
                    setOverageError('')
                    const { data } = await supabase.auth.getSession()
                    const token = data.session?.access_token
                    if (!token) { setOverageError('Not signed in'); setOverageLoading(false); return }
                    const res = await fetch('/api/billing/setup', {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    const json = await res.json() as { url?: string; error?: string }
                    if (!res.ok || !json.url) {
                      setOverageError(json.error ?? 'Could not open card setup')
                      setOverageLoading(false)
                      return
                    }
                    window.location.href = json.url
                  }}
                  style={{
                    padding: '8px 18px', borderRadius: 8, border: 'none',
                    background: overageLoading ? '#888' : '#f5f5f5',
                    color: '#111', cursor: overageLoading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {overageLoading ? 'Redirecting…' : 'Add card'}
                </button>
              ) : (
              <button
                disabled={overageLoading}
                onClick={async () => {
                  setOverageLoading(true)
                  setOverageError('')
                  const { data } = await supabase.auth.getSession()
                  const token = data.session?.access_token
                  if (!token) {
                    setOverageError('Not signed in')
                    setOverageLoading(false)
                    return
                  }
                  const res = await fetch('/api/billing/overage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ count: uploadQueue.pendingOverageCount }),
                  })
                  const json = await res.json() as { error?: string; message?: string }
                  if (!res.ok) {
                    setOverageError(json.error ?? json.message ?? 'Payment failed')
                    setOverageLoading(false)
                    return
                  }
                  uploadQueue.confirmOverage()
                  setOverageLoading(false)
                }}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: overageLoading ? '#888' : '#f5f5f5',
                  color: '#111', cursor: overageLoading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                {overageLoading ? 'Charging…' : `Upload for $${uploadQueue.pendingOverageCost.toFixed(2)}`}
              </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Auth gate — shown when not signed in */}

    </>
  )
}
