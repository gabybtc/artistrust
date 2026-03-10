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
import { Artwork } from './types'
import { uploadImage, compressBase64ForAnalysis, compressFileForStorage } from './uploadImage'

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
  activeTab: 'painting' | 'photography'
  onArtworkAdded: (artwork: Artwork) => void
  onArtworkUpdated: (id: string, updates: Partial<Artwork>) => void
}): UploadQueueHandle {
  const { userId, activeTab, onArtworkAdded, onArtworkUpdated } = options

  const [items, setItems] = useState<QueueItem[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [isVisible, setVisible] = useState(false)

  // Refs let callbacks always see fresh values without stale closures
  const itemsRef     = useRef<QueueItem[]>([])
  const pausedRef    = useRef(false)
  const activeTabRef = useRef(activeTab)
  const userIdRef    = useRef(userId)
  // Track how many slots are actively running (read/upload/analyze)
  const activeCount  = useRef(0)

  useEffect(() => { activeTabRef.current = activeTab }, [activeTab])
  useEffect(() => { userIdRef.current = userId }, [userId])

  // Rate-limit simultaneous Claude API calls (storage uploads use activeCount)
  const analysisSem = useRef(makeSemaphore(ANALYSIS_CONCURRENCY))

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
    // ── 1. Read file to base64 ────────────────────────────────────────────
    patchItem(item.qid, { state: 'reading', _file: undefined })

    let imageData: string
    try {
      imageData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('FileReader failed'))
        reader.readAsDataURL(file)
      })
    } catch {
      patchItem(item.qid, { state: 'error', error: 'Could not read file' })
      return
    }

    // ── 2. Derive a human title from filename ─────────────────────────────
    const fileTitle = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[_\-]+/g, ' ')
      .trim()

    // ── 3. Create artwork card immediately — appears in gallery at once ───
    const artwork: Artwork = {
      id: artworkId,
      imageData,
      fileName: file.name,
      title: fileTitle,
      year: '', place: '', location: '',
      width: '', height: '', unit: 'cm',
      material: '',
      mediaType: activeTabRef.current,
      status: 'uploading',
      uploadedAt: new Date().toISOString(),
      copyrightStatus: 'automatic',
      copyrightHolder: '',
      copyrightYear: new Date().getFullYear().toString(),
      copyrightRegNumber: '',
    }
    onArtworkAdded(artwork)

    patchItem(item.qid, { state: 'uploading' })

    // ── 4. Storage upload + AI analysis — run in parallel ─────────────────
    const storagePromise = compressFileForStorage(file)
      .then(c => uploadImage(c, uid, artworkId))
      .then(url => onArtworkUpdated(artworkId, { imageData: url }))
      .catch(err => console.error('Storage upload error:', file.name, err))

    const analysisPromise = (async () => {
      patchItem(item.qid, { state: 'analyzing' })
      onArtworkUpdated(artworkId, { status: 'analyzing' })

      const compressed = await compressBase64ForAnalysis(imageData)

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
            onArtworkUpdated(artworkId, {
              status: 'ready',
              aiAnalysis: data.analysis,
              title: fileTitle || data.analysis.suggestedTitle || '',
              material: data.analysis.medium || '',
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
  const addFiles = useCallback((files: File[]) => {
    if (!userIdRef.current) return
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
    // Kick dispatch on next tick — gives React a chance to flush the state update
    setTimeout(() => dispatchRef.current(), 0)
  }, [])

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

  return { items, stats, isPaused, addFiles, pause, resume, retryErrors, clearDone, isVisible, setVisible }
}
