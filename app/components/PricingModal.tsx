'use client'

import { useState } from 'react'
import { PLAN_CONFIG } from '@/lib/plans'
import type { Plan } from '@/lib/plans'

const PLAN_RANK: Record<Plan, number> = { preserve: 0, studio: 1, archive: 2, beta: 3 }

interface Props {
  onClose: () => void
  onUpgrade: (plan: 'studio' | 'archive' | 'preserve', interval: 'monthly' | 'annual') => void
  /** Highlight a specific locked feature to show context-aware messaging */
  lockedFeature?: 'copyright' | 'exif' | 'portfolio' | 'pdf' | 'upload_limit'
  /** Currently active plan — used to show upgrade/downgrade/current labels */
  currentPlan?: Plan
  /** Opens the Stripe billing portal */
  onManageBilling?: () => void
}

export default function PricingModal({ onClose, onUpgrade, lockedFeature, currentPlan = 'preserve', onManageBilling }: Props) {
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly')

  const lockedMessages: Record<string, string> = {
    upload_limit: 'You\'ve reached the 50-work limit on the Preserve plan.',
    copyright:    'Copyright export packages require the Studio plan or above.',
    exif:         'Film archive metadata requires the Studio plan or above.',
    portfolio:    'Shareable public portfolios require the Archive plan.',
    pdf:          'PDF catalog export requires the Archive plan.',
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pricing plans"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 16px',
        backdropFilter: 'blur(6px)',
        overflowY: 'auto',
      }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        width: '100%',
        maxWidth: 1020,
        position: 'relative',
        marginTop: 'auto',
        marginBottom: 'auto',
      }}>

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 20, right: 20, zIndex: 10,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', fontSize: 20, lineHeight: 1, padding: 4,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
        >
          ×
        </button>

        {/* Header */}
        <div style={{ padding: '48px 48px 32px', textAlign: 'center' }}>
          {lockedFeature && (
            <p style={{
              fontSize: 13, color: 'var(--accent)', marginBottom: 20,
              fontFamily: 'var(--font-body)', letterSpacing: '0.04em',
            }}>
              {lockedMessages[lockedFeature]}
            </p>
          )}

          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 30, fontWeight: 400, fontStyle: 'italic',
            color: 'var(--text)', marginBottom: 8,
          }}>
            Choose your archive
          </h2>
          <p style={{
            fontSize: 13, color: 'var(--text-dim)',
            fontFamily: 'var(--font-body)', marginBottom: 28,
          }}>
            Save 20% with an annual plan.
          </p>

          {/* Monthly / Annual toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <p style={{
              fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
              color: 'var(--text-dim)', fontFamily: 'var(--font-body)', margin: 0,
            }}>
              Billing period
            </p>
            <div style={{
              display: 'inline-flex',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 3, padding: 4,
              gap: 2,
            }}>
              {(['monthly', 'annual'] as const).map(i => (
                <button
                  key={i}
                  onClick={() => setInterval(i)}
                  style={{
                    background: interval === i ? 'var(--accent)' : 'transparent',
                    border: 'none', borderRadius: 2,
                    padding: '9px 28px',
                    fontFamily: 'var(--font-body)',
                    fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: interval === i ? '#0a0a0a' : 'var(--text-dim)',
                    cursor: 'pointer', transition: 'all 0.18s',
                    fontWeight: interval === i ? 600 : 400,
                  }}
                >
                  {i === 'monthly' ? 'Monthly' : 'Annual  ·  20% off'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tier cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 0,
          borderTop: '1px solid var(--border)',
        }}>
          {(['preserve', 'studio', 'archive'] as const).map(planKey => {
            const cfg = PLAN_CONFIG[planKey]
            const isStudio = planKey === 'studio'
            const isArchive = planKey === 'archive'
            const isPaid = isStudio || isArchive
            const price = interval === 'annual' ? cfg.annualMonthlyPrice : cfg.monthlyPrice
            const isHighlighted = isStudio

            return (
              <div
                key={planKey}
                style={{
                  padding: '36px 40px 40px',
                  borderRight: planKey !== 'archive' ? '1px solid var(--border)' : undefined,
                  background: isHighlighted ? 'rgba(201,169,110,0.03)' : 'transparent',
                  position: 'relative',
                }}
              >
                {/* Most Popular badge */}
                {isHighlighted && (
                  <div style={{
                    position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--accent)', color: '#0a0a0a',
                    fontFamily: 'var(--font-body)',
                    fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
                    padding: '4px 14px',
                    borderRadius: '0 0 3px 3px',
                    fontWeight: 600,
                  }}>
                    Most Popular
                  </div>
                )}

                <p style={{
                  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
                  color: 'var(--text-dim)', fontFamily: 'var(--font-body)', marginBottom: 10,
                }}>
                  {cfg.tier}
                </p>

                <h3 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28, fontWeight: 400, fontStyle: 'italic',
                  color: isHighlighted ? 'var(--accent)' : 'var(--text)',
                  marginBottom: 10,
                }}>
                  {cfg.label}
                </h3>

                <p style={{
                  fontSize: 12, color: 'var(--text-dim)',
                  fontFamily: 'var(--font-body)', marginBottom: 24, lineHeight: 1.5,
                }}>
                  {cfg.tagline}
                </p>

                {/* Price */}
                <div style={{ marginBottom: 8 }}>
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 40, fontWeight: 400, color: 'var(--text)',
                  }}>
                    ${price}
                  </span>
                  <span style={{
                    fontSize: 12, color: 'var(--text-dim)',
                    fontFamily: 'var(--font-body)', marginLeft: 4,
                  }}>
                    / mo
                  </span>
                </div>

                {interval === 'annual' && isPaid && (
                  <p style={{
                    fontSize: 11, color: 'var(--accent)',
                    fontFamily: 'var(--font-body)', marginBottom: 8,
                  }}>
                    Billed ${cfg.annualTotal}/year
                  </p>
                )}

                {/* CTA button */}
                {(() => {
                  const isCurrent = planKey === currentPlan
                  const isUpgrade = PLAN_RANK[planKey] > PLAN_RANK[currentPlan]
                  const ctaLabel = isCurrent
                    ? 'Current plan'
                    : isUpgrade
                      ? `Upgrade to ${cfg.label}`
                      : `Downgrade to ${cfg.label}`
                  return (
                    <div style={{ marginTop: interval === 'annual' && isPaid ? 0 : 28, marginBottom: 28 }}>
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                        {isCurrent ? (
                          <div style={{
                            fontSize: 11, color: 'var(--text-dim)',
                            fontFamily: 'var(--font-body)', letterSpacing: '0.08em',
                          }}>
                            Current plan
                          </div>
                        ) : planKey === 'preserve' ? (
                          <button
                            onClick={() => onUpgrade('preserve', interval)}
                            style={{
                              width: '100%',
                              background: 'transparent',
                              border: '1px solid var(--border)',
                              borderRadius: 2, padding: '10px 0',
                              fontFamily: 'var(--font-body)',
                              fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                              color: 'var(--text-dim)',
                              cursor: 'pointer', transition: 'all 0.18s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
                          >
                            {ctaLabel}
                          </button>
                        ) : (
                          <button
                            onClick={() => onUpgrade(planKey, interval)}
                            style={{
                              width: '100%',
                              background: isHighlighted && isUpgrade ? 'var(--accent)' : 'transparent',
                              border: `1px solid ${isHighlighted && isUpgrade ? 'var(--accent)' : 'var(--border)'}`,
                              borderRadius: 2, padding: '10px 0',
                              fontFamily: 'var(--font-body)',
                              fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
                              color: isHighlighted && isUpgrade ? '#0a0a0a' : 'var(--text)',
                              cursor: 'pointer', transition: 'all 0.18s',
                            }}
                            onMouseEnter={e => {
                              if (!(isHighlighted && isUpgrade)) {
                                e.currentTarget.style.borderColor = 'var(--accent-dim)'
                                e.currentTarget.style.color = 'var(--accent)'
                              }
                            }}
                            onMouseLeave={e => {
                              if (!(isHighlighted && isUpgrade)) {
                                e.currentTarget.style.borderColor = 'var(--border)'
                                e.currentTarget.style.color = 'var(--text)'
                              }
                            }}
                          >
                            {ctaLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Feature list */}
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {cfg.features.map(f => (
                    <li key={f.label} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      fontSize: 12,
                      color: f.included ? 'var(--text)' : 'var(--text-dim)',
                      fontFamily: 'var(--font-body)',
                      opacity: f.included ? 1 : 0.5,
                    }}>
                      <span style={{
                        fontSize: 10, flexShrink: 0, marginTop: 1,
                        color: f.included ? 'var(--accent)' : 'inherit',
                      }}>
                        {f.included ? '✓' : '×'}
                      </span>
                      {f.label}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Footer note */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '16px 48px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
        }}>
          <p style={{
            fontSize: 11, color: 'var(--text-dim)',
            fontFamily: 'var(--font-body)', letterSpacing: '0.04em', margin: 0,
          }}>
            Annual plans include a 20% discount. Additional uploads beyond your monthly limit are $0.05 each.
          </p>
          {onManageBilling && (
            <button
              onClick={onManageBilling}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 2, padding: '5px 14px', flexShrink: 0,
                fontFamily: 'var(--font-body)', fontSize: 11,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--text-dim)', cursor: 'pointer', transition: 'all 0.18s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
            >
              Manage billing
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
