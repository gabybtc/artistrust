'use client'

import { useState } from 'react'
import { PLAN_CONFIG } from '@/lib/plans'
import type { Plan } from '@/lib/plans'

const PLAN_RANK: Record<Plan, number> = { preserve: 0, studio: 1, archive: 2, beta: 3 }

interface Props {
  onClose: () => void
  onUpgrade: (plan: 'studio' | 'archive', interval: 'monthly' | 'annual') => void
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
    pdf:          'PDF catalogue export requires the Archive plan.',
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
            Save 20% with an annual plan — free legacy upload included.
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

                {interval === 'annual' && isPaid && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: 'rgba(201,169,110,0.1)',
                    border: '1px solid var(--accent-dim)',
                    borderRadius: 2, padding: '3px 9px',
                    marginBottom: 16,
                  }}>
                    <span style={{ color: 'var(--accent)', fontSize: 10 }}>✓</span>
                    <span style={{
                      fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                      color: 'var(--accent)', fontFamily: 'var(--font-body)',
                    }}>
                      Free legacy upload included
                    </span>
                  </div>
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
                            onClick={() => onManageBilling ? onManageBilling() : onClose()}
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

        {/* Legacy upload banner */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '32px 48px',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 40, alignItems: 'center',
        }}>
          <div>
            <h4 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 17, fontWeight: 400, fontStyle: 'italic',
              color: 'var(--text)', marginBottom: 10,
            }}>
              Bringing a legacy archive?
            </h4>
            <p style={{
              fontSize: 12, color: 'var(--text-dim)',
              fontFamily: 'var(--font-body)', lineHeight: 1.6,
            }}>
              {interval === 'annual'
                ? 'Annual subscribers get a free legacy upload — bulk-import your entire back-catalog at no extra cost. Monthly subscribers pay a small one-time fee for batches over 50 works.'
                : 'Already have a large back-catalog? Existing subscribers can perform a Legacy Upload directly through their account. A one-time fee applies for bulk imports over 50 works. Switch to annual and it\'s included free.'}
            </p>
          </div>

          {/* Legacy pricing tiers */}
          <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
            {[
              { label: '1–50 Works', price: interval === 'annual' ? 'Free' : 'Free',  sub: interval === 'annual' ? 'always free' : null },
              { label: '51–200',     price: interval === 'annual' ? 'Free' : '$15',   sub: interval === 'annual' ? 'annual plan' : null },
              { label: '201–500',    price: interval === 'annual' ? 'Free' : '$29',   sub: interval === 'annual' ? 'annual plan' : null },
              { label: '501+',       price: interval === 'annual' ? 'Free' : '$0.10', sub: interval === 'annual' ? 'annual plan' : 'per upload' },
            ].map((tier, i, arr) => (
              <div key={tier.label} style={{
                padding: '16px 20px',
                textAlign: 'center',
                borderTop: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                borderLeft: '1px solid var(--border)',
                borderRight: i === arr.length - 1 ? '1px solid var(--border)' : undefined,
                minWidth: 90,
                background: interval === 'annual' && i > 0 ? 'rgba(201,169,110,0.04)' : 'transparent',
                transition: 'background 0.2s',
              }}>
                <p style={{
                  fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: 'var(--text-dim)', fontFamily: 'var(--font-body)', marginBottom: 6,
                }}>
                  {tier.label}
                </p>
                <p style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20, fontWeight: 400,
                  color: (i === 0 || interval === 'annual') ? 'var(--accent)' : 'var(--text)',
                  fontStyle: (i === 0 || interval === 'annual') ? 'italic' : undefined,
                }}>
                  {tier.price}
                </p>
                {tier.sub && (
                  <p style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-body)', marginTop: 2 }}>
                    {tier.sub}
                  </p>
                )}
              </div>
            ))}
          </div>
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
            Annual plans include a 20% discount and a free legacy upload for your entire archive.
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
