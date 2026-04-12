'use client'
import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AuthModal from '../components/AuthModal'
import type { Plan, BillingInterval } from '@/lib/plans'

const PAID_PLANS: Plan[] = ['studio', 'archive']

function SignupInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawPlan = searchParams.get('plan') as Plan | null
  const rawInterval = searchParams.get('interval') as BillingInterval | null
  const plan = rawPlan && PAID_PLANS.includes(rawPlan) ? rawPlan : undefined
  const interval = rawInterval === 'monthly' || rawInterval === 'annual' ? rawInterval : undefined

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/')
    })
  }, [router])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <AuthModal
        standalone
        defaultView="signup"
        planIntent={plan}
        intervalIntent={interval}
        onAuth={() => router.push('/')}
      />
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupInner />
    </Suspense>
  )
}
