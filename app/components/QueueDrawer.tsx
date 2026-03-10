'use client'

import { useState } from 'react'
import { QueueItem, QueueStats, QueueItemState } from '@/lib/useUploadQueue'

interface QueueDrawerProps {
  items: QueueItem[]
  stats: QueueStats
  isPaused: boolean
  isVisible: boolean
  onPause: () => void
  onResume: () => void
  onRetryErrors: () => void
  onClearDone: () => void
  onClose: () => void
}

const neon = '#ffe600'

const stateColor: Record<QueueItemState, string> = {
  waiting:   'var(--muted)',
  reading:   '#7eb8ff',
  uploading: '#7eb8ff',
  analyzing: neon,
  done:      '#4caf7d',
  error:     '#e05c5c',
}

const stateLabel: Record<QueueItemState, string> = {
  waiting:   'Waiting',
  reading:   'Reading',
  uploading: 'Uploading',
  analyzing: 'Analysing',
  done:      'Done',
  error:     'Error',
}

function StatusDot({ state }: { state: QueueItemState }) {
  const isActive = state === 'uploading' || state === 'analyzing' || state === 'reading'
  return (
    <span style={{
      display: 'inline-block',
      width: 7, height: 7,
      borderRadius: '50%',
      background: stateColor[state],
      boxShadow: isActive ? `0 0 6px ${stateColor[state]}` : 'none',
      flexShrink: 0,
      animation: isActive ? 'qpulse 1.4s ease-in-out infinite' : 'none',
    }} />
  )
}

export default function QueueDrawer({
  items, stats, isPaused, isVisible,
  onPause, onResume, onRetryErrors, onClearDone, onClose,
}: QueueDrawerProps) {
  const [expanded, setExpanded] = useState(true)

  if (!isVisible || stats.total === 0) return null

  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
  const isComplete = stats.active === 0 && stats.waiting === 0 && stats.errors === 0
  const hasErrors = stats.errors > 0

  return (
    <>
      {/* Keyframe injected once */}
      <style>{`
        @keyframes qpulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
      `}</style>

      <div style={{
        position: 'fixed',
        bottom: 20, right: 20,
        width: expanded ? 360 : 260,
        background: 'rgba(14,14,14,0.97)',
        border: `1px solid rgba(255,230,0,0.18)`,
        borderRadius: 6,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        zIndex: 900,
        fontFamily: 'var(--font-body)',
        transition: 'width 0.25s',
        overflow: 'hidden',
      }}>

        {/* ── Header bar ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 12px',
          borderBottom: expanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
          cursor: 'default',
        }}>
          {/* Summary text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: isComplete ? '#4caf7d' : neon,
                fontWeight: 600,
              }}>
                {isComplete ? 'Complete' : isPaused ? 'Paused' : 'Uploading'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {stats.done}/{stats.total}
                {hasErrors ? ` · ${stats.errors} error${stats.errors > 1 ? 's' : ''}` : ''}
              </span>
            </div>

            {/* Progress bar */}
            <div style={{
              marginTop: 5, height: 2,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 2, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: hasErrors ? '#e05c5c' : isComplete ? '#4caf7d' : neon,
                borderRadius: 2,
                transition: 'width 0.4s ease',
                boxShadow: isComplete ? 'none' : `0 0 6px ${neon}40`,
              }} />
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {!isComplete && (
              <button
                onClick={isPaused ? onResume : onPause}
                title={isPaused ? 'Resume' : 'Pause'}
                style={iconBtn}
              >
                {isPaused
                  ? <svg width="11" height="11" viewBox="0 0 12 12" fill={neon}><polygon points="2,1 11,6 2,11"/></svg>
                  : <svg width="11" height="11" viewBox="0 0 12 12" fill={neon}><rect x="2" y="1" width="3" height="10"/><rect x="7" y="1" width="3" height="10"/></svg>
                }
              </button>
            )}
            {hasErrors && (
              <button onClick={onRetryErrors} title="Retry errors" style={iconBtn}>
                <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="#e05c5c" strokeWidth="2">
                  <path d="M4 10a6 6 0 1 1 1.4 3.8" strokeLinecap="round"/>
                  <path d="M4 14V10H8" strokeLinecap="round" strokeLinejoin="round" fill="#e05c5c"/>
                </svg>
              </button>
            )}
            {stats.done > 0 && (
              <button onClick={onClearDone} title="Clear done" style={iconBtn}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--muted)" strokeWidth="1.5">
                  <path d="M2 3h8M5 3V2h2v1M4.5 5v4M7.5 5v4M3 3l.5 7h5L9 3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
            <button onClick={() => setExpanded(e => !e)} title={expanded ? 'Collapse' : 'Expand'} style={iconBtn}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--muted)" strokeWidth="1.5">
                {expanded
                  ? <path d="M2 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round"/>
                  : <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                }
              </svg>
            </button>
            <button onClick={onClose} title="Dismiss" style={iconBtn}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--muted)" strokeWidth="1.5">
                <path d="M2 2l8 8M10 2l-8 8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── File list ──────────────────────────────────────────────────── */}
        {expanded && (
          <div style={{
            maxHeight: 260,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}>
            {/* Show active + waiting + errors first, then done */}
            {[...items]
              .sort((a, b) => ORDER[a.state] - ORDER[b.state])
              .map(item => (
                <div key={item.qid} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                }}>
                  <StatusDot state={item.state} />
                  <span style={{
                    flex: 1, minWidth: 0,
                    fontSize: 11, color: item.state === 'done' ? 'var(--muted)' : 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.fileName}
                  </span>
                  <span style={{
                    fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: stateColor[item.state],
                    flexShrink: 0,
                  }}>
                    {item.error ? 'Error' : stateLabel[item.state]}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </>
  )
}

// Sort order: active first, then waiting, then errors, then done
const ORDER: Record<QueueItemState, number> = {
  analyzing: 0,
  uploading: 1,
  reading:   2,
  waiting:   3,
  error:     4,
  done:      5,
}

const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '3px 4px',
  borderRadius: 3,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  opacity: 0.8,
}
