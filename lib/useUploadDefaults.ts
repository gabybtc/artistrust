'use client'

/**
 * useUploadDefaults — persists user-chosen sticky field values across page loads.
 *
 * Stored in localStorage under "artistrust:upload-defaults".
 *
 * On first mount, if the user has never saved a copyrightHolder default and
 * a profile fullName is provided, it seeds copyrightHolder automatically so
 * the artist's name appears pre-filled from day one.
 */

import { useCallback, useEffect, useState } from 'react'
import { UploadDefaults } from './types'

const STORAGE_KEY = 'artistrust:upload-defaults'
// Tracks whether the user has *ever* explicitly saved copyrightHolder themselves.
// If they have, we no longer overwrite with the profile name on mount.
const HOLDER_USER_SET_KEY = 'artistrust:upload-defaults:holder-set'

function read(): UploadDefaults {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as UploadDefaults) : {}
  } catch {
    return {}
  }
}

function write(d: UploadDefaults) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
  } catch { /* ignore quota errors */ }
}

export function useUploadDefaults(options?: { profileFullName?: string }) {
  const [defaults, setDefaultsState] = useState<UploadDefaults>({})

  // Hydrate from localStorage on mount, then seed copyrightHolder from profile if needed
  useEffect(() => {
    const saved = read()
    if (
      !saved.copyrightHolder &&
      options?.profileFullName &&
      !localStorage.getItem(HOLDER_USER_SET_KEY)
    ) {
      saved.copyrightHolder = options.profileFullName
      write(saved)
    }
    setDefaultsState(saved)
  // We intentionally run only once on mount; profileFullName is read once for seeding.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the profile name changes (user updates their profile), update the holder
  // default only if the user has never chosen their own value.
  useEffect(() => {
    if (!options?.profileFullName) return
    if (localStorage.getItem(HOLDER_USER_SET_KEY)) return
    setDefaultsState(prev => {
      if (prev.copyrightHolder === options.profileFullName) return prev
      const next = { ...prev, copyrightHolder: options.profileFullName }
      write(next)
      return next
    })
  }, [options?.profileFullName])

  const setDefault = useCallback(<K extends keyof UploadDefaults>(
    field: K,
    value: UploadDefaults[K],
  ) => {
    if (field === 'copyrightHolder') {
      try { localStorage.setItem(HOLDER_USER_SET_KEY, '1') } catch { /* ignore */ }
    }
    setDefaultsState(prev => {
      const next = { ...prev, [field]: value }
      write(next)
      return next
    })
  }, [])

  const clearDefault = useCallback((field: keyof UploadDefaults) => {
    if (field === 'copyrightHolder') {
      try { localStorage.removeItem(HOLDER_USER_SET_KEY) } catch { /* ignore */ }
    }
    setDefaultsState(prev => {
      const next = { ...prev }
      delete next[field]
      write(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(HOLDER_USER_SET_KEY)
    } catch { /* ignore */ }
    setDefaultsState({})
  }, [])

  return { defaults, setDefault, clearDefault, clearAll }
}
