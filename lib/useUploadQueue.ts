'use client'

/**
 * useUploadQueue — unlimited folder/bulk upload queue for ArtisTrust.
 *
 * Pipeline per file:
 *   waiting → reading → uploading (storage + analysis fire in parallel) → done | error
 *
 * Concurrency controls:
 *   - Up to UPLOAD_CONCURRENCY files processed end-to-end simultaneously
 *   - AI analysis capped at ANALYSIS_CONCURRENCY simultaneous requests
 *
 * Usage:
 *   const queue = useUploadQueue({ userId, activeTab, onArtworkAdded, onArtworkUpdated })
 *   queue.addFiles(files)          // accepts unlimited files, folder dumps, etc.
 *   queue.pause() / queue.resume()
 *   queue.retryErrors()
 *   queue.clearDone()
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Artwork, UploadDefaults } from './types'
import { uploadImage, compressFileForAnalysis, compressFileForStorage } from './uploadImage'
import { extractExif, exifToTags } from './extractExif'
import { parseHints } from './parseFileName'
import { OVERAGE_COST_USD, OVERAGE_MIN_CHARGE_USD } from './plans'
// ─── Tuneable constants ───────────────────────────────────────────────────────
const UPLOAD_CONCURRENCY  = 3   // simultaneous full-pipeline workers
const ANALYSIS_CONCURRENCY = 2  // simultaneous Claude API calls within those workers
const ANALYSIS_RETRIES     = 3
const ANALYSIS_RETRY_DELAY = 2000

// ─── Types ───────────────────────────────────────────────────────────────────
export type QueueItemState = 'waiting' | 'reading' | 'uploading' | 'analyzing' | 'done' | 'error'

export interface QueueItem {
  qid: string          // queue-internal id (not the artwork id)
  artworkId: string    // Artwork.id — set immediately on creation
  fileName: string
  state: QueueItemState
  error?: string
  _file?: File         // kept only while waiting/reading, cleared after to free memory
}

export interface QueueStats {
  total: number
  waiting: number
  active: number
  done: number
  errors: number
}

export interface UploadQueueHandle {
  items: QueueItem[]
  stats: QueueStats
  isPaused: boolean
  addFiles: (files: File[]) => void
  pause: () => void
  resume: () => void
  retryErrors: () => void
  clearDone: () => void
  isVisible: boolean
  setVisible: (v: boolean) => void
  /** Proceed with overage files after user confirms the $0.05/upload charge */
  confirmOverage: () => void
  /** Cancel the queued overage files */
  cancelOverage: () => void
  /** Number of files pending overage confirmation (0 when none) */
  pendingOverageCount: number
  /** Total cost in USD of pending overage files */
  pendingOverageCost: number
}

// ─── Simple semaphore ─────────────────────────────────────────────────────────
function makeSemaphore(n: number) {
  let count = 0
  const waiting: Array<() => void> = []
  const acquire = (): Promise<void> =>
    new Promise(resolve => {
      if (count < n) { count++; resolve() }
      else waiting.push(() => { count++; resolve() })
    })
  const release = () => {
    count--
    const next = waiting.shift()
    if (next) next()
  }
  return { acquire, release }
}

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useUploadQueue(options: {
  userId: string | null
  activeTab: string
  onArtworkAdded: (artwork: Artwork) => void
  onArtworkUpdated: (id: string, updates: Partial<Artwork>) => void
  defaults?: UploadDefaults
  /** Monthly upload count this calendar month — used to enforce monthly limits */
  monthlyUploadsUsed?: number
  /** Monthly upload limit for this plan (null = unlimited) */
  monthlyUploadLimit?: number | null
  /** Called when an upload is blocked by the plan limit */
  onPlanLimit?: () => void
}): UploadQueueHandle {
  const { userId, activeTab, onArtworkAdded, onArtworkUpdated, defaults, monthlyUploadsUsed, monthlyUploadLimit, onPlanLimit } = options

  const [items, setItems] = useState<QueueItem[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [isVisible, setVisible] = useState(false)
  const [pendingOverageCount, setPendingOverageCount] = useState(0)
  const [pendingOverageCost, setPendingOverageCost] = useState(0)
  const pendingOverageRef = useRef<File[]>([])

  // Refs let callbacks always see fresh values without stale closures
  const itemsRef          = useRef<QueueItem[]>([])
  const pausedRef         = useRef(false)
  const activeTabRef      = useRef(activeTab)
  const userIdRef         = useRef(userId)
  const defaultsRef       = useRef<UploadDefaults>(defaults ?? {})
  const monthlyUsedRef    = useRef<number>(monthlyUploadsUsed ?? 0)
  const monthlyLimitRef   = useRef<number | null | undefined>(monthlyUploadLimit)
  // Track how many slots are actively running (read/upload/analyze)
  const activeCount  = useRef(0)

  useEffect(() => { activeTabRef.current = activeTab }, [activeTab])
  useEffect(() => { userIdRef.current = userId }, [userId])
  useEffect(() => { defaultsRef.current = defaults ?? {} }, [defaults])
  useEffect(() => { monthlyUsedRef.current = monthlyUploadsUsed ?? 0 }, [monthlyUploadsUsed])
  useEffect(() => { monthlyLimitRef.current = monthlyUploadLimit }, [monthlyUploadLimit])

  // Rate-limit simultaneous Claude API calls (storage uploads use activeCount)
  const analysisSem = useRef(makeSemaphore(ANALYSIS_CONCURRENCY))

  // Camera tags extracted from EXIF — keyed by artworkId, merged with AI tags
  // when analysis completes so neither set overwrites the other.
  const cameraTagsRef = useRef<Map<string, string[]>>(new Map())

  // ── Item state helpers ────────────────────────────────────────────────────
  const patchItem = useCallback((qid: string, patch: Partial<QueueItem>) => {
    itemsRef.current = itemsRef.current.map(i => i.qid === qid ? { ...i, ...patch } : i)
    setItems([...itemsRef.current])
  }, [])

  // ── Dispatch — fills available concurrency slots with waiting items ──────
  // Must be defined before processItem so processItem can call it on completion.
  // Using a ref so processItem's closure can call the latest version.
  const dispatchRef = useRef<() => void>(() => {})

  // ── Core processing pipeline ──────────────────────────────────────────────
  const processItem = useCallback(async (item: QueueItem) => {
    const uid = userIdRef.current
    if (!uid || !item._file) { activeCount.current--; dispatchRef.current(); return }

    const file = item._file
    const artworkId = item.artworkId

    try {
    // ── 1. Derive a title from filename ───────────────────────────────────
    patchItem(item.qid, { state: 'uploading', _file: undefined })

    const fileTitle = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[_\-]+/g, ' ')
      .trim()

    // ── 2. Create artwork card — use a blob URL, not base64 ───────────────
    // Blob URLs are browser-managed and don't inflate the JS heap, which
    // prevents memory pressure when uploading large batches of high-res files.
    const blobUrl = URL.createObjectURL(file)
    const d = defaultsRef.current
    const artwork: Artwork = {
      id: artworkId,
      imageData: blobUrl,
      fileName: file.name,
      title: fileTitle,
      year: d.year ?? '', place: d.place ?? '', location: d.location ?? '',
      width: '', height: '', unit: 'cm',
      material: d.material ?? '',
      mediaType: activeTabRef.current,
      status: 'uploading',
      uploadedAt: new Date().toISOString(),
      copyrightStatus: 'automatic',
      copyrightHolder: d.copyrightHolder ?? '',
      copyrightYear: d.year ?? new Date().getFullYear().toString(),
      copyrightRegNumber: '',
      ...(d.series ? { series: d.series } : {}),
    }
    onArtworkAdded(artwork)

    // ── 3. Storage upload + AI analysis — run in parallel ─────────────────
    const storagePromise = compressFileForStorage(file)
      .then(c => uploadImage(c, uid, artworkId))
      .then(url => {
        URL.revokeObjectURL(blobUrl)
        onArtworkUpdated(artworkId, { imageData: url })
      })
      .catch(err => {
        URL.revokeObjectURL(blobUrl)
        console.error('Storage upload error:', file.name, err)
      })

    const analysisPromise = (async () => {
      patchItem(item.qid, { state: 'analyzing' })
      onArtworkUpdated(artworkId, { status: 'analyzing' })

      // Compress directly from the File — never creates a full base64 in memory
      let compressed: string
      try {
        compressed = await compressFileForAnalysis(file)
      } catch {
        onArtworkUpdated(artworkId, { status: 'ready' })
        return
      }

      const attempt = async (): Promise<boolean> => {
        try {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 9000)
          const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData: compressed }),
            signal: controller.signal,
          })
          clearTimeout(timer)
          if (!res.ok) return false
          const data = await res.json()
          if (data.analysis) {
            const existingCameraTags = cameraTagsRef.current.get(artworkId) ?? []
            const aiTags = Array.isArray(data.analysis.tags) ? data.analysis.tags : []
            onArtworkUpdated(artworkId, {
              status: 'ready',
              aiAnalysis: data.analysis,
              title: fileTitle || data.analysis.suggestedTitle || '',
              // Only fill material from AI if the user has no default set
              ...(data.analysis.medium && !defaultsRef.current.material
                ? { material: data.analysis.medium }
                : {}),
              tags: [...existingCameraTags, ...aiTags],
            })
            return true
          }
          return false
        } catch {
          return false
        }
      }

      for (let t = 0; t < ANALYSIS_RETRIES; t++) {
        if (t > 0) await new Promise(r => setTimeout(r, ANALYSIS_RETRY_DELAY))
        await analysisSem.current.acquire()
        try {
          const ok = await attempt()
          if (ok) return
        } finally {
          analysisSem.current.release()
        }
      }
      // Analysis failed after retries — still mark artwork ready
      onArtworkUpdated(artworkId, { status: 'ready' })
    })()

    await Promise.all([storagePromise, analysisPromise])
    patchItem(item.qid, { state: 'done' })

    } catch {
      patchItem(item.qid, { state: 'error', error: 'Processing failed' })
    } finally {
      activeCount.current--
      dispatchRef.current()
    }
  }, [onArtworkAdded, onArtworkUpdated, patchItem])

  // ── Dispatch — kicks off processing for as many waiting items as possible ──
  const dispatch = useCallback(() => {
    if (pausedRef.current) return
    const slots = UPLOAD_CONCURRENCY - activeCount.current
    if (slots <= 0) return

    const waiting = itemsRef.current.filter(i => i.state === 'waiting' && i._file)
    const toStart = waiting.slice(0, slots)
    if (toStart.length === 0) return

    // Mark items as 'reading' synchronously in the ref so re-entrant dispatch
    // calls can't double-pick the same items
    const qids = new Set(toStart.map(i => i.qid))
    itemsRef.current = itemsRef.current.map(i =>
      qids.has(i.qid) ? { ...i, state: 'reading' as QueueItemState } : i
    )
    // Also update React state for the UI
    setItems([...itemsRef.current])

    toStart.forEach(item => {
      activeCount.current++
      processItem(item)  // item still has _file since it's the original ref snapshot
    })
  }, [processItem])

  // Keep dispatchRef current so processItem's finally block always calls latest
  useEffect(() => { dispatchRef.current = dispatch }, [dispatch])

  // ── Public API ────────────────────────────────────────────────────────────
  const addFiles = useCallback((inputFiles: File[]) => {
    let files = [...inputFiles]
    if (!userIdRef.current) return

    // Monthly upload limit check — read from refs so we always see current values
    const limit = monthlyLimitRef.current
    if (limit !== null && limit !== undefined) {
      const alreadyQueued = itemsRef.current.filter(i => i.state !== 'done' && i.state !== 'error').length
      const monthlyBase = monthlyUsedRef.current + alreadyQueued
      const remaining = Math.max(0, limit - monthlyBase)
      if (remaining === 0) {
        // All are overage — hold for confirmation
        pendingOverageRef.current = files
        setPendingOverageCount(files.length)
        setPendingOverageCost(Math.max(OVERAGE_MIN_CHARGE_USD, Math.round(files.length * OVERAGE_COST_USD * 100) / 100))
        return
      }
      if (remaining < files.length) {
        // Split: some within limit, rest need confirmation
        const overageFiles = files.slice(remaining)
        files = files.slice(0, remaining)
        pendingOverageRef.current = overageFiles
        setPendingOverageCount(overageFiles.length)
        setPendingOverageCost(Math.max(OVERAGE_MIN_CHARGE_USD, Math.round(overageFiles.length * OVERAGE_COST_USD * 100) / 100))
      }
    }
    const newItems: QueueItem[] = files.map(f => ({
      qid: uuidv4(),
      artworkId: uuidv4(),
      fileName: f.name,
      state: 'waiting' as QueueItemState,
      _file: f,
    }))

    itemsRef.current = [...itemsRef.current, ...newItems]
    setItems([...itemsRef.current])
    setVisible(true)

    // Extract EXIF + filename hints for each file, then update the artwork card
    // before the item starts uploading. We do this async after enqueue so the
    // queue UI shows up immediately without blocking.
    newItems.forEach(async (item) => {
      const file = item._file!
      const [exif, hints] = await Promise.all([
        extractExif(file),
        Promise.resolve(
          parseHints(
            file.name,
            // DropZone attaches relativePath when a folder is dropped
            (file as File & { relativePath?: string }).relativePath
          )
        ),
      ])
      const year = exif.year ?? hints.year ?? ''
      const cameraTags = exifToTags(exif)
      if (year || Object.keys(exif).length > 0 || cameraTags.length > 0) {
        if (cameraTags.length > 0) {
          cameraTagsRef.current.set(item.artworkId, cameraTags)
        }
        onArtworkUpdated(item.artworkId, {
          ...(year ? { year } : {}),
          exifData: Object.keys(exif).length > 0 ? exif : undefined,
          ...(cameraTags.length > 0 ? { tags: cameraTags } : {}),
        })
      }
    })

    // Kick dispatch on next tick — gives React a chance to flush the state update
    setTimeout(() => dispatchRef.current(), 0)
  }, [onArtworkUpdated])

  const pause = useCallback(() => {
    pausedRef.current = true
    setIsPaused(true)
  }, [])

  const resume = useCallback(() => {
    pausedRef.current = false
    setIsPaused(false)
    dispatchRef.current()
  }, [])

  const retryErrors = useCallback(() => {
    itemsRef.current = itemsRef.current.map(i =>
      i.state === 'error' && i._file ? { ...i, state: 'waiting' as QueueItemState, error: undefined } : i
    )
    setItems([...itemsRef.current])
    setTimeout(() => dispatchRef.current(), 0)
  }, [])

  const confirmOverage = useCallback(() => {
    const overageFiles = pendingOverageRef.current
    if (!overageFiles.length) return
    pendingOverageRef.current = []
    setPendingOverageCount(0)
    setPendingOverageCost(0)
    // Enqueue overage files directly, bypassing the limit check
    const newItems: QueueItem[] = overageFiles.map(f => ({
      qid: uuidv4(),
      artworkId: uuidv4(),
      fileName: f.name,
      state: 'waiting' as QueueItemState,
      _file: f,
    }))
    itemsRef.current = [...itemsRef.current, ...newItems]
    setItems([...itemsRef.current])
    setVisible(true)
    // Extract EXIF/hints for overage files the same as normal uploads
    newItems.forEach(async (item) => {
      const file = item._file!
      const [exif, hints] = await Promise.all([
        extractExif(file),
        Promise.resolve(
          parseHints(file.name, (file as File & { relativePath?: string }).relativePath)
        ),
      ])
      const year = exif.year ?? hints.year ?? ''
      const cameraTags = exifToTags(exif)
      if (year || Object.keys(exif).length > 0 || cameraTags.length > 0) {
        if (cameraTags.length > 0) cameraTagsRef.current.set(item.artworkId, cameraTags)
        onArtworkUpdated(item.artworkId, {
          ...(year ? { year } : {}),
          exifData: Object.keys(exif).length > 0 ? exif : undefined,
          ...(cameraTags.length > 0 ? { tags: cameraTags } : {}),
        })
      }
    })
    setTimeout(() => dispatchRef.current(), 0)
  }, [onArtworkUpdated])

  const cancelOverage = useCallback(() => {
    pendingOverageRef.current = []
    setPendingOverageCount(0)
    setPendingOverageCost(0)
  }, [])

  const clearDone = useCallback(() => {
    itemsRef.current = itemsRef.current.filter(i => i.state !== 'done')
    setItems([...itemsRef.current])
  }, [])

  const stats: QueueStats = {
    total:   items.length,
    waiting: items.filter(i => i.state === 'waiting').length,
    active:  items.filter(i => ['reading', 'uploading', 'analyzing'].includes(i.state)).length,
    done:    items.filter(i => i.state === 'done').length,
    errors:  items.filter(i => i.state === 'error').length,
  }

  return { items, stats, isPaused, addFiles, pause, resume, retryErrors, clearDone, isVisible, setVisible, confirmOverage, cancelOverage, pendingOverageCount, pendingOverageCost }
}
