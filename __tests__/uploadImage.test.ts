/**
 * uploadImage.ts — unit tests
 *
 * Canvas / Image APIs are mocked because jsdom has no real rendering engine.
 * The tests focus on the Supabase interaction and timeout behaviour of uploadImage,
 * and on the timeout / error-handling paths of compressFileForAnalysis and
 * compressFileForStorage that were added to fix the large-batch hang.
 */

import { vi, expect, describe, it, beforeEach, afterEach } from 'vitest'

// ─── Mock the Supabase client ─────────────────────────────────────────────────
// vi.mock is hoisted to the top of the file, so its factory cannot reference
// variables declared later. vi.hoisted() runs before the hoist and solves this.
const { mockUpload, mockGetPublicUrl, mockRemove, mockFrom } = vi.hoisted(() => {
  const mockUpload       = vi.fn()
  const mockGetPublicUrl = vi.fn()
  const mockRemove       = vi.fn()
  const mockFrom         = vi.fn(() => ({
    upload:       mockUpload,
    getPublicUrl: mockGetPublicUrl,
    remove:       mockRemove,
  }))
  return { mockUpload, mockGetPublicUrl, mockRemove, mockFrom }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: mockFrom } },
}))

import {
  uploadImage,
  compressFileForStorage,
  compressFileForAnalysis,
} from '@/lib/uploadImage'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeFile(name = 'painting.jpg', type = 'image/jpeg'): File {
  return new File([new Uint8Array(64)], name, { type })
}

/** Build a mock <img> element that fires onload synchronously after src is set. */
function makeMockImage({ fail = false } = {}) {
  return {
    set src(_: string) {
      setTimeout(() => {
        if (fail) { this.onerror?.() }
        else       { this.onload?.() }
      }, 0)
    },
    onload:  null as (() => void) | null,
    onerror: null as (() => void) | null,
  }
}

/** Build a mock <canvas> that returns JPEG data from toDataURL and calls toBlob cb. */
function makeMockCanvas(blobResult: Blob | null = new Blob(['x'], { type: 'image/jpeg' })) {
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage: vi.fn() })),
    toDataURL: vi.fn(() => 'data:image/jpeg;base64,compressed'),
    toBlob: vi.fn((cb: (blob: Blob | null) => void) => setTimeout(() => cb(blobResult), 0)),
  }
}

// ─── uploadImage ─────────────────────────────────────────────────────────────
describe('uploadImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue({ error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/artworks/user/123.jpg' } })
  })

  it('uploads to the correct storage path: {userId}/{artworkId}.{ext}', async () => {
    const file = makeFile('canvas.png', 'image/png')
    await uploadImage(file, 'user-1', 'artwork-99')

    expect(mockFrom).toHaveBeenCalledWith('artworks')
    expect(mockUpload).toHaveBeenCalledWith(
      'user-1/artwork-99.png',
      file,
      expect.objectContaining({ upsert: false }),
    )
  })

  it('returns the public URL from Supabase on success', async () => {
    const file = makeFile('oil.jpg')
    const url = await uploadImage(file, 'user-1', 'art-1')

    expect(url).toBe('https://cdn.example.com/artworks/user/123.jpg')
  })

  it('uses the full name as extension when the filename contains no dot', async () => {
    // file.name.split('.').pop() returns the whole name when there are no dots;
    // the '?? jpg' fallback in uploadImage is only reachable if pop() returns
    // undefined, which cannot happen on a non-empty split result.
    const file = new File([new Uint8Array(8)], 'no-extension', { type: 'image/jpeg' })
    await uploadImage(file, 'user-1', 'art-2')

    const uploadPath = mockUpload.mock.calls[0][0] as string
    expect(uploadPath).toBe('user-1/art-2.no-extension')
  })

  it('throws when Supabase returns an error', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'Row too large' } })

    await expect(uploadImage(makeFile(), 'user-1', 'art-3')).rejects.toThrow('Upload failed: Row too large')
  })

  it('throws when the upload stalls past the timeout', async () => {
    vi.useFakeTimers()
    try {
      // Never resolves — simulates a stalled network connection
      mockUpload.mockReturnValue(new Promise(() => {}))

      // Attach the rejection handler BEFORE advancing timers so the promise
      // is never seen as "unhandled" even momentarily.
      const assertion = expect(
        uploadImage(makeFile(), 'user-1', 'art-4', 5_000)
      ).rejects.toThrow('Upload timed out')

      await vi.advanceTimersByTimeAsync(5_001)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })
})

// ─── compressFileForStorage ───────────────────────────────────────────────────
describe('compressFileForStorage', () => {
  let origCreateElement: typeof document.createElement

  beforeEach(() => {
    origCreateElement = document.createElement.bind(document)
  })

  afterEach(() => {
    document.createElement = origCreateElement
    vi.restoreAllMocks()
  })

  it('returns a JPEG File when the canvas produces a blob', async () => {
    const mockCanvas = makeMockCanvas()
    const mockImg    = makeMockImage()

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLElement
      return origCreateElement(tag)
    })
    vi.spyOn(window, 'Image').mockImplementation(() => mockImg as unknown as HTMLImageElement)

    const result = await compressFileForStorage(makeFile('photo.png', 'image/png'))

    expect(result).toBeInstanceOf(File)
    expect(result.type).toBe('image/jpeg')
    expect(result.name).toMatch(/\.jpg$/)
  })

  it('returns the original file when the canvas produces a null blob', async () => {
    const mockCanvas = makeMockCanvas(null)  // toBlob yields null
    const mockImg    = makeMockImage()

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLElement
      return origCreateElement(tag)
    })
    vi.spyOn(window, 'Image').mockImplementation(() => mockImg as unknown as HTMLImageElement)

    const input = makeFile()
    const result = await compressFileForStorage(input)

    expect(result).toBe(input)
  })

  it('returns the original file when Image fails to load', async () => {
    const mockImg = makeMockImage({ fail: true })
    vi.spyOn(window, 'Image').mockImplementation(() => mockImg as unknown as HTMLImageElement)

    const input = makeFile()
    const result = await compressFileForStorage(input)

    expect(result).toBe(input)
  })

  it('falls back to the original file if canvas.toBlob never calls its callback', async () => {
    vi.useFakeTimers()

    const hangingCanvas = {
      width: 0, height: 0,
      getContext: vi.fn(() => ({ drawImage: vi.fn() })),
      toBlob: vi.fn(), // never calls the callback
    }
    const mockImg = {
      set src(_: string) { setTimeout(() => this.onload?.(), 0) },
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
    }

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return hangingCanvas as unknown as HTMLElement
      return origCreateElement(tag)
    })
    vi.spyOn(window, 'Image').mockImplementation(() => mockImg as unknown as HTMLImageElement)

    const input = makeFile()
    const resultPromise = compressFileForStorage(input)

    // Advance past the 15 s fallback
    await vi.advanceTimersByTimeAsync(15_001)

    const result = await resultPromise
    expect(result).toBe(input)

    vi.useRealTimers()
  })
})

// ─── compressFileForAnalysis ──────────────────────────────────────────────────
describe('compressFileForAnalysis', () => {
  let origCreateElement: typeof document.createElement

  beforeEach(() => {
    origCreateElement = document.createElement.bind(document)
  })

  afterEach(() => {
    document.createElement = origCreateElement
    vi.restoreAllMocks()
  })

  it('returns a data: URL string on success', async () => {
    const mockCanvas = makeMockCanvas()
    const mockImg    = makeMockImage()

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLElement
      return origCreateElement(tag)
    })
    vi.spyOn(window, 'Image').mockImplementation(() => mockImg as unknown as HTMLImageElement)

    const result = await compressFileForAnalysis(makeFile())

    expect(result).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('rejects when Image fails to load', async () => {
    const mockImg = makeMockImage({ fail: true })
    vi.spyOn(window, 'Image').mockImplementation(() => mockImg as unknown as HTMLImageElement)

    await expect(compressFileForAnalysis(makeFile())).rejects.toThrow('Image load failed')
  })

  /**
   * Critical non-regression: the old base64 approach would silently hang here
   * under memory pressure. The new implementation rejects with an explicit error
   * after 15 s, so the queue's analysisPromise can catch it and mark the artwork
   * 'ready' instead of freezing.
   */
  it('rejects with a timeout error if Image never fires onload', async () => {
    vi.useFakeTimers()
    try {
      // Image that never fires any event
      const silentImg = { onload: null, onerror: null, set src(_: string) {} }
      vi.spyOn(window, 'Image').mockImplementation(() => silentImg as unknown as HTMLImageElement)
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

      // Attach handler BEFORE advancing timers to prevent unhandled-rejection warning.
      const assertion = expect(
        compressFileForAnalysis(makeFile())
      ).rejects.toThrow('compressFileForAnalysis timed out')

      await vi.advanceTimersByTimeAsync(15_001)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })
})
