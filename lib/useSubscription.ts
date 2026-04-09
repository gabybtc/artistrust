'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import type { UserSubscription } from './types'
import {
  canUploadMore,
  canExportCopyright,
  canViewExif,
  canSharePortfolio,
  canShareWork,
  canExportPdf,
  getMonthlyUploadLimit,
} from './plans'

const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === 'true'

interface UseSubscriptionResult {
  subscription: UserSubscription | null
  loading: boolean
  refresh: () => void
  // Permission helpers baked into the hook for convenience
  canUploadMore: (monthlyCount: number) => boolean
  canExportCopyright: boolean
  canViewExif: boolean
  canShareWork: boolean
  canSharePortfolio: boolean
  canExportPdf: boolean
  /** Monthly upload limit for this plan (null = unlimited) */
  monthlyUploadLimit: number | null
  openCheckout: (plan: 'studio' | 'archive' | 'preserve', interval: 'monthly' | 'annual') => Promise<void>
  openPortal: () => Promise<void>
}

const DEFAULT_SUB: UserSubscription = {
  userId: '',
  plan: 'preserve',
  billingInterval: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  currentPeriodEnd: null,
  isBeta: false,
  createdAt: '',
  updatedAt: '',
}

const NOOP = async () => {}

const BILLING_DISABLED_RESULT: UseSubscriptionResult = {
  subscription: null,
  loading: false,
  refresh: NOOP,
  canUploadMore: () => true,
  canExportCopyright: true,
  canViewExif: true,
  canShareWork: true,
  canSharePortfolio: true,
  canExportPdf: true,
  monthlyUploadLimit: null,
  openCheckout: NOOP,
  openPortal: NOOP,
}

export function useSubscription(): UseSubscriptionResult {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSub = useCallback(async () => {
    if (!BILLING_ENABLED) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setSubscription(null); setLoading(false); return }

    const res = await fetch('/api/billing/subscription', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.ok) {
      const data: UserSubscription = await res.json()
      setSubscription(data)
    } else {
      setSubscription({ ...DEFAULT_SUB, userId: session.user.id })
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!BILLING_ENABLED) return
    fetchSub()
    // Re-fetch when Supabase auth state changes (e.g. sign-in/out)
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(() => {
      fetchSub()
    })
    return () => authSub.unsubscribe()
  }, [fetchSub])

  if (!BILLING_ENABLED) return BILLING_DISABLED_RESULT

  const plan = subscription?.plan ?? 'preserve'
  const interval = subscription?.billingInterval ?? null

  const openCheckout = async (
    targetPlan: 'studio' | 'archive' | 'preserve',
    targetInterval: 'monthly' | 'annual',
  ) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ type: 'subscription', plan: targetPlan, interval: targetInterval }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error ?? 'Plan change failed')
    }
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else if (data.updated) {
      await fetchSub()
    }
  }

  const openPortal = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    const res = await fetch('/api/billing/portal', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error ?? 'Could not open billing portal')
    }
    const { url } = await res.json()
    if (url) window.location.href = url
  }

  return {
    subscription,
    loading,
    refresh: fetchSub,
    canUploadMore: (count: number) => canUploadMore(plan, count),
    canExportCopyright: canExportCopyright(plan),
    canViewExif: canViewExif(plan),
    canShareWork: canShareWork(plan),
    canSharePortfolio: canSharePortfolio(plan),
    canExportPdf: canExportPdf(plan),
    monthlyUploadLimit: getMonthlyUploadLimit(plan),
    openCheckout,
    openPortal,
  }
}
