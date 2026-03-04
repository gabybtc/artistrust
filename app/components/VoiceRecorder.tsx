'use client'

import { useState, useRef, useCallback } from 'react'

interface VoiceRecorderProps {
  existingAudio?: string
  onSave: (audioData: string) => void
}

export default function VoiceRecorder({ existingAudio, onSave }: VoiceRecorderProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'recorded'>('idle')
  const [audioUrl, setAudioUrl] = useState<string | null>(existingAudio || null)
  const [duration, setDuration] = useState(0)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder.current = new MediaRecorder(stream)
      chunks.current = []

      mediaRecorder.current.ondataavailable = e => chunks.current.push(e.data)
      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          setAudioUrl(dataUrl)
          onSave(dataUrl)
        }
        reader.readAsDataURL(blob)
        stream.getTracks().forEach(t => t.stop())
        setState('recorded')
      }

      mediaRecorder.current.start()
      setState('recording')
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch (err) {
      console.error('Microphone access denied:', err)
      alert('Please allow microphone access to record your artist story.')
    }
  }, [onSave])

  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && state === 'recording') {
      mediaRecorder.current.stop()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [state])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 2,
      padding: '20px',
    }}>
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: 13,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--text-dim)',
        marginBottom: 16,
      }}>
        Artist's Story
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Record / Stop button */}
        {state === 'idle' && (
          <button
            onClick={startRecording}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'transparent',
              border: '1px solid var(--accent-dim)',
              borderRadius: 2, padding: '10px 18px',
              color: 'var(--accent)', cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,169,110,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="var(--accent)">
              <circle cx="6" cy="6" r="6"/>
            </svg>
            {audioUrl ? 'Re-record story' : 'Record story'}
          </button>
        )}

        {state === 'recording' && (
          <button
            onClick={stopRecording}
            className="pulse-record"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(200, 60, 60, 0.12)',
              border: '1px solid rgba(200,60,60,0.5)',
              borderRadius: 2, padding: '10px 18px',
              color: '#e05555', cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="#e05555">
              <rect width="10" height="10" rx="1"/>
            </svg>
            Stop &nbsp;·&nbsp; {formatTime(duration)}
          </button>
        )}

        {/* Audio playback */}
        {audioUrl && state !== 'recording' && (
          <div style={{ flex: 1 }}>
            <audio
              src={audioUrl}
              controls
              style={{
                width: '100%', height: 28,
                filter: 'invert(1) sepia(1) saturate(0.5) hue-rotate(180deg)',
              }}
            />
          </div>
        )}
      </div>

      {state === 'recording' && (
        <p style={{ marginTop: 12, fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
          Speak freely — describe the work, what inspired it, when and where it was made…
        </p>
      )}

      {audioUrl && state === 'recorded' && (
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="var(--accent)" style={{ opacity: 0.7 }}>
            <circle cx="5" cy="5" r="5"/>
          </svg>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
            Story recorded and saved
          </p>
        </div>
      )}
    </div>
  )
}
