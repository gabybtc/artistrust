/**
 * useUploadQueue — integration-style tests
 *
 * External I/O is fully mocked:
 *   - uploadImage, compressFileForStorage, compressFileForAnalysis → instant resolves
 *   - global.fetch → instant success response
 *   - URL.createObjectURL / revokeObjectURL → mocked in __tests__/setup.ts
 *
 * Nothing here hits the network or Supabase.
 */

import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, expect, describe, it, beforeEach } from 'vitest'
import { useUploadQueue } from '@/lib/useUploadQueue'
import * as uploadImageModule from '@/lib/uploadImage'

// ─── Module mocks ─────────────────────────────────────────────────────────────
vi.mock('@/lib/uploadImage', () => ({
  uploadImage: vi.fn(),
  compressFileForStorage: vi.fn(),
  compressFileForAnalysis: vi.fn(),
}))

const mockUploadImage       = vi.mocked(uploadImageModule.uploadImage)
const mockCompressStorage   = vi.mocked(uploadImageModule.compressFileForStorage)
const mockCompressAnalysis  = vi.mocked(uploadImageModule.compressFileForAnalysis)

const STORAGE_URL   = 'https://cdn.example.com/artwork.jpg'
const COMPRESSED_B64 = 'data:image/jpeg;base64,compressed'
const MOCK_ANALYSIS = {
  style: 'Impressionism',
  medium: 'Oil on canvas',
  subject: 'Landscape',
  description: 'A peaceful pastoral scene.',
  colorPalette: ['#a1b2c3'],
  suggestedTitle: 'Morning Light',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeFile(name = 'art.jpg'): File {
  return new File([new Uint8Array(64)], name, { type: 'image/jpeg' })
}

function makeFiles(count: number): File[] {
  return Array.from({ length: count }, (_, i) => makeFile(`painting-${i + 1}.jpg`))
}

function makeOptions() {
  const onArtworkAdded   = vi.fn()
  const onArtworkUpdated = vi.fn()
  return {
    options: {
      userId: 'user-abc' as string | null,
      activeTab: 'painting' as 'painting' | 'photography',
      onArtworkAdded,
      onArtworkUpdated,
    },
    onArtworkAdded,
    onArtworkUpdated,
  }
}

// ─── Reset mocks before each test ────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()

  mockUploadImage.mockResolvedValue(STORAGE_URL)
  mockCompressStorage.mockImplementation((f) => Promise.resolve(f))
  mockCompressAnalysis.mockResolvedValue(COMPRESSED_B64)

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ analysis: MOCK_ANALYSIS }),
  })
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('large-batch processing', () => {
  /**
   * Core regression test — the original bug caused 2 of 91 files to get stuck
   * in 'analyzing' forever. This test verifies every item in a 91-file batch
   * reaches 'done' with zero errors.
   */
  it('processes all 91 files to done state with no errors', async () => {
    const { options, onArtworkAdded } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.addFiles(makeFiles(91)))

    await waitFor(
      () => expect(result.current.stats.done).toBe(91),
      { timeout: 15_000 }
    )

    expect(result.current.stats.errors).toBe(0)
    expect(result.current.stats.waiting).toBe(0)
    expect(result.current.stats.active).toBe(0)
    expect(onArtworkAdded).toHaveBeenCalledTimes(91)
  })

  it('calls onArtworkUpdated with status:ready for every file in the batch', async () => {
    const { options, onArtworkUpdated } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.addFiles(makeFiles(91)))

    await waitFor(
      () => expect(result.current.stats.done).toBe(91),
      { timeout: 15_000 }
    )

    const readyCalls = onArtworkUpdated.mock.calls.filter(([, u]) => u.status === 'ready')
    expect(readyCalls).toHaveLength(91)
  })
})

describe('concurrency control', () => {
  it('never runs more than 3 concurrent workers', async () => {
    let concurrent = 0
    let maxConcurrent = 0

    // Use compressFileForStorage as the concurrency measurement point — it runs
    // at the start of each worker and is awaited before upload.
    mockCompressStorage.mockImplementation(async (file) => {
      concurrent++
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await new Promise(r => setTimeout(r, 10))
      concurrent--
      return file
    })

    const { options } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.addFiles(makeFiles(12)))

    await waitFor(
      () => expect(result.current.stats.done).toBe(12),
      { timeout: 10_000 }
    )

    expect(maxConcurrent).toBeLessThanOrEqual(3)
  })
})

describe('blob URL usage (no base64 in heap)', () => {
  it('calls onArtworkAdded with a blob: URL, never a data: URL', async () => {
    const { options, onArtworkAdded } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.addFiles([makeFile('landscape.jpg')]))

    await waitFor(() => expect(result.current.stats.done).toBe(1))

    const [artwork] = onArtworkAdded.mock.calls[0]
    expect(artwork.imageData).toMatch(/^blob:/)
    expect(artwork.imageData).not.toMatch(/^data:/)
    expect(artwork.imageData).not.toMatch(/base64/)
  })

  it('replaces the blob URL with the real storage URL after upload completes', async () => {
    const { options, onArtworkUpdated } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.addFiles([makeFile('art.jpg')]))

    await waitFor(() => expect(result.current.stats.done).toBe(1))

    const urlUpdate = onArtworkUpdated.mock.calls.find(([, u]) => u.imageData === STORAGE_URL)
    expect(urlUpdate).toBeDefined()
  })

  it('revokes the blob URL once the real storage URL is available', async () => {
    const revokeSpy = vi.fn()
    URL.revokeObjectURL = revokeSpy

    const { options } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.addFiles([makeFile('art.jpg')]))

    await waitFor(() => expect(result.current.stats.done).toBe(1))

    expect(revokeSpy).toHaveBeenCalledTimes(1)
  })
})

describe('AI analysis results', () => {
  it('applies analysis fields to the artwork when API succeeds', async () => {
    const { options, onArtworkUpdated } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.addFiles([makeFile('portrait.jpg')]))

    await waitFor(() => expect(result.current.stats.done).toBe(1))

    const analysisCall = onArtworkUpdated.mock.calls.find(([, u]) => u.aiAnalysis !== undefined)
    expect(analysisCall).toBeDefined()
    expect(analysisCall![1].aiAnalysis).toEqual(MOCK_ANALYSIS)
    expect(analysisCall![1].material).toBe(MOCK_ANALYSIS.medium)
    expect(analysisCall![1].status).toBe('ready')
  })

  /**
   * Critical non-regression: if the API fails on every retry, the artwork must
   * still reach status:'ready'. A stuck 'analyzing' state is the original bug.
   */
  it('still marks artwork ready when the analysis API always returns non-ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })

    const { options, onArtworkUpdated } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.addFiles([makeFile('art.jpg')]))

    // Allow for 3 retries × 2 s delay = up to 6 s
    await waitFor(
      () => expect(result.current.stats.done).toBe(1),
      { timeout: 10_000 }
    )

    const readyCall = onArtworkUpdated.mock.calls.find(([, u]) => u.status === 'ready')
    expect(readyCall).toBeDefined()
    expect(result.current.stats.errors).toBe(0)
  })

  /**
   * Critical non-regression: if the analysis API throws (e.g. network error /
   * AbortController timeout), the artwork must still reach status:'ready'.
   */
  it('still marks artwork ready when every analysis fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const { options, onArtworkUpdated } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.addFiles([makeFile('art.jpg')]))

    await waitFor(
      () => expect(result.current.stats.done).toBe(1),
      { timeout: 10_000 }
    )

    const readyCall = onArtworkUpdated.mock.calls.find(([, u]) => u.status === 'ready')
    expect(readyCall).toBeDefined()
    expect(result.current.stats.errors).toBe(0)
  })

  /**
   * Critical non-regression: if compressFileForAnalysis itself throws (as it now
   * does on timeout instead of silently hanging), the artwork must still reach
   * status:'ready' and must not freeze as 'analyzing'.
   */
  it('still marks artwork ready when compressFileForAnalysis throws', async () => {
    mockCompressAnalysis.mockRejectedValue(new Error('compressFileForAnalysis timed out'))

    const { options, onArtworkUpdated } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.addFiles([makeFile('large.jpg')]))

    await waitFor(() => expect(result.current.stats.done).toBe(1))

    const readyCall = onArtworkUpdated.mock.calls.find(([, u]) => u.status === 'ready')
    expect(readyCall).toBeDefined()
    expect(result.current.stats.errors).toBe(0)
  })

  it('sends the compressed base64 image to /api/analyze, never the raw blob URL', async () => {
    const { options } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.addFiles([makeFile('art.jpg')]))

    await waitFor(() => expect(result.current.stats.done).toBe(1))

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)
    expect(body.imageData).toBe(COMPRESSED_B64)
    expect(body.imageData).not.toMatch(/^blob:/)
  })
})

describe('pause / resume', () => {
  it('stops new items from starting when paused', async () => {
    const { options } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.pause())
    act(() => result.current.addFiles(makeFiles(5)))

    // Give the scheduler a moment
    await new Promise(r => setTimeout(r, 60))

    expect(result.current.stats.done).toBe(0)
    expect(result.current.stats.active).toBe(0)
    expect(result.current.isPaused).toBe(true)
  })

  it('drains the full queue after resume', async () => {
    const { options } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.pause())
    act(() => result.current.addFiles(makeFiles(6)))
    act(() => result.current.resume())

    await waitFor(() => expect(result.current.stats.done).toBe(6))

    expect(result.current.stats.errors).toBe(0)
    expect(result.current.isPaused).toBe(false)
  })
})

describe('clearDone', () => {
  it('removes all completed items from the list', async () => {
    const { options } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.addFiles(makeFiles(3)))
    await waitFor(() => expect(result.current.stats.done).toBe(3))

    act(() => result.current.clearDone())

    expect(result.current.items).toHaveLength(0)
    expect(result.current.stats.total).toBe(0)
  })

  it('only removes done items, leaving errored items in place', async () => {
    // The only realistic code path that puts an item in 'error' state is an
    // exception thrown synchronously before the first await in processItem.
    // URL.createObjectURL throwing (e.g. under out-of-memory conditions)
    // is exactly such a path — it's inside the outer try/catch.
    let calls = 0
    URL.createObjectURL = vi.fn().mockImplementation(() => {
      calls++
      if (calls === 1) throw new Error('Out of memory')
      return `blob:mock-${calls}`
    })

    const { options } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.addFiles(makeFiles(2)))
    await waitFor(() => expect(result.current.stats.done + result.current.stats.errors).toBe(2))

    expect(result.current.stats.errors).toBe(1)

    act(() => result.current.clearDone())

    // The errored item is preserved; the done item is removed
    expect(result.current.stats.errors).toBe(1)
    expect(result.current.items.filter(i => i.state === 'error')).toHaveLength(1)
  })
})

describe('queue visibility', () => {
  it('becomes visible when files are added', () => {
    const { options } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    expect(result.current.isVisible).toBe(false)

    act(() => result.current.addFiles([makeFile()]))

    expect(result.current.isVisible).toBe(true)
  })
})

describe('artwork metadata derivation', () => {
  it('strips file extension and converts separators to spaces for the title', async () => {
    const { options, onArtworkAdded } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.addFiles([makeFile('my_great-painting.jpg')]))

    await waitFor(() => expect(result.current.stats.done).toBe(1))

    const [artwork] = onArtworkAdded.mock.calls[0]
    expect(artwork.title).toBe('my great painting')
  })

  it('sets the correct mediaType from activeTab at the time of upload', async () => {
    const photoOptions = makeOptions()
    photoOptions.options.activeTab = 'photography'

    const { result } = renderHook(() => useUploadQueue(photoOptions.options))

    act(() => result.current.addFiles([makeFile('photo.jpg')]))

    await waitFor(() => expect(result.current.stats.done).toBe(1))

    const [artwork] = photoOptions.onArtworkAdded.mock.calls[0]
    expect(artwork.mediaType).toBe('photography')
  })

  it('ignores addFiles when userId is null', () => {
    const { options, onArtworkAdded } = makeOptions()
    options.userId = null

    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.addFiles([makeFile()]))

    expect(result.current.items).toHaveLength(0)
    expect(onArtworkAdded).not.toHaveBeenCalled()
  })
})

describe('stats computed values', () => {
  it('reports correct total / waiting / active / done counts during processing', async () => {
    // Slow down storage so we can observe in-flight state
    mockCompressStorage.mockImplementation(async (file) => {
      await new Promise(r => setTimeout(r, 30))
      return file
    })

    const { options } = makeOptions()
    const { result } = renderHook(() => useUploadQueue(options))

    act(() => result.current.addFiles(makeFiles(5)))

    // At some point before completion, total should be 5 and some should be active
    await waitFor(() => expect(result.current.stats.active).toBeGreaterThan(0))
    expect(result.current.stats.total).toBe(5)

    await waitFor(() => expect(result.current.stats.done).toBe(5), { timeout: 10_000 })
    expect(result.current.stats.active).toBe(0)
    expect(result.current.stats.waiting).toBe(0)
  })
})
