'use client'

import { useState } from 'react'
import type { Plan, BillingInterval } from '@/lib/plans'
import { hasFreeLegacyUpload, getLegacyUploadFee } from '@/lib/plans'
import { supabase } from '@/lib/supabase'

interface Props {
  plan: Plan
  billingInterval: BillingInterval | null
  onClose: () => void
  /** Called after the legacy upload is unlocked (payment completed or free) */
  onUnlocked: () => void
}

const TIERS = [
  { label: '1–50 Works', range: '1-50',     price: 'Free',  cents: 0 },
  { label: '51–200',     range: '51-200',   price: '$15',   cents: 1500 },
  { label: '201–500',    range: '201-500',  price: '$29',   cents: 2900 },
  { label: '501+',       range: '501+',     price: '$0.10', cents: null, perUpload: true },
]

export default function LegacyUploadModal({ plan, billingInterval, onClose, onUnlocked }: Props) {
  const [step, setStep] = useState<'explain' | 'enter-count' | 'processing'>('explain')
  const [workCount, setWorkCount] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isFreeUser = hasFreeLegacyUpload(plan, billingInterval)

  const handleContinue = async () => {
    const count = parseInt(workCount, 10)
    if (!count || count < 1) { setError('Please enter a valid number of works.'); return }

    const { cents } = getLegacyUploadFee(count, plan, billingInterval)
    setError(null)
    setStep('processing')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Please sign in first.'); setStep('enter-count'); return }

      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: 'legacy', workCount: count }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong. Please try again.')
        setStep('enter-count')
        return
      }

      const data = await res.json()

      // Free path — unlocked immediately
      if (data.free || cents === 0) {
        onUnlocked()
        return
      }

      // Paid path — redirect to Stripe
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError('Network error. Please try again.')
      setStep('enter-count')
    }
  }

  const count = parseInt(workCount, 10) || 0
  const { cents, tier } = count > 0
    ? getLegacyUploadFee(count, plan, billingInterval)
    : { cents: 0, tier: '' }
  const feeDisplay = cents === 0 ? 'Free' : `$${(cents / 100).toFixed(2)}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Legacy archive upload"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 70,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(6px)',
        padding: '24px 16px',
      }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        width: '100%',
        maxWidth: 560,
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '32px 36px 24px',
          borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22, fontWeight: 400, fontStyle: 'italic',
            color: 'var(--text)', marginBottom: 8,
          }}>
            Legacy Archive Upload
          </h2>
          <p style={{
            fontSize: 12, color: 'var(--text-dim)',
            fontFamily: 'var(--font-body)', lineHeight: 1.6,
          }}>
            {isFreeUser
              ? 'As an annual subscriber, your legacy upload is completely free. Enter the number of existing works to import in bulk.'
              : 'Import your existing back-catalog in one go. A one-time fee covers AI analysis costs for bulk uploads over 50 works.'}
          </p>
        </div>

        {/* Pricing table */}
        {!isFreeUser && (
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
          }}>
            {TIERS.map((t, i) => (
              <div key={t.range} style={{
                flex: 1,
                padding: '20px 16px',
                textAlign: 'center',
                borderRight: i < TIERS.length - 1 ? '1px solid var(--border)' : undefined,
                background: tier === t.range && count > 0 ? 'rgba(201,169,110,0.06)' : 'transparent',
              }}>
                <p style={{
                  fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: 'var(--text-dim)', fontFamily: 'var(--font-body)', marginBottom: 6,
                }}>
                  {t.label}
                </p>
                <p style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 18, fontWeight: 400,
                  color: i === 0 ? 'var(--accent)' : 'var(--text)',
                  fontStyle: i === 0 ? 'italic' : undefined,
                }}>
                  {t.price}
                </p>
                {t.perUpload && (
                  <p style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-body)', marginTop: 2 }}>
                    per upload
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '28px 36px 32px' }}>
          {step !== 'processing' && (
            <>
              <label style={{
                display: 'block',
                fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--text-dim)', fontFamily: 'var(--font-body)', marginBottom: 8,
              }}>
                Number of works to import
              </label>
              <input
                type="number"
                min="1"
                value={workCount}
                onChange={e => { setWorkCount(e.target.value); setError(null) }}
                placeholder="e.g. 150"
                style={{
                  width: '100%', padding: '10px 14px',
                  background: 'var(--bg)',
                  border: `1px solid ${error ? '#e05a5a' : 'var(--border)'}`,
                  borderRadius: 2,
                  color: 'var(--text)', fontSize: 14,
                  fontFamily: 'var(--font-body)', fontWeight: 300,
                  outline: 'none',
                  marginBottom: 16,
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                onBlur={e => (e.target.style.borderColor = error ? '#e05a5a' : 'var(--border)')}
              />

              {error && (
                <p style={{ fontSize: 12, color: '#e05a5a', fontFamily: 'var(--font-body)', marginBottom: 16 }}>
                  {error}
                </p>
              )}

              {count > 0 && (
                <p style={{
                  fontSize: 12, color: 'var(--accent)',
                  fontFamily: 'var(--font-body)', marginBottom: 20,
                }}>
                  {count} works → one-time fee: <strong>{feeDisplay}</strong>
                  {isFreeUser && ' (included with your annual plan)'}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleContinue}
                  disabled={!workCount || parseInt(workCount) < 1}
                  style={{
                    flex: 1,
                    background: 'var(--accent)', border: 'none', borderRadius: 2,
                    padding: '10px 0',
                    fontFamily: 'var(--font-body)',
                    fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: '#0a0a0a', cursor: 'pointer',
                    opacity: !workCount || parseInt(workCount) < 1 ? 0.4 : 1,
                  }}
                >
                  {isFreeUser || cents === 0 ? 'Begin import' : `Pay ${feeDisplay} & import`}
                </button>
                <button
                  onClick={onClose}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    border: '1px solid var(--border)', borderRadius: 2,
                    fontFamily: 'var(--font-body)',
                    fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: 'var(--text-dim)', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {step === 'processing' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'var(--font-body)' }}>
                Redirecting to checkout…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
