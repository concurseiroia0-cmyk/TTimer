// Circular gauge modeled on the "Summary / kWp Produced now" reference:
// an arc (open at the bottom) whose stroke drains counterclockwise as the
// day's balance is spent, with the big number in the center and a caption
// underneath. The number counts up smoothly on mount (micro-interaction).

import { useEffect, useRef, useState } from 'react'
import { secondsToHHMMSS } from '../engine/timebank'

const SIZE = 260
const STROKE = 16
// Arc geometry: circle radius, exposed from 135° to 405° (270° sweep, gap at bottom).
const RADIUS = (SIZE - STROKE) / 2 - 4
const SWEEP_DEG = 270
const START_ANGLE = 135
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const ARC_LENGTH = (SWEEP_DEG / 360) * CIRCUMFERENCE

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(): string {
  const start = polar(SIZE / 2, SIZE / 2, RADIUS, START_ANGLE)
  const end = polar(SIZE / 2, SIZE / 2, RADIUS, START_ANGLE + SWEEP_DEG)
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 1 1 ${end.x} ${end.y}`
}

export function SummaryGauge({
  remainingSeconds,
  startingSeconds,
  renewsIn,
}: {
  remainingSeconds: number
  startingSeconds: number
  renewsIn: number // seconds until the day renews
}) {
  const ratio = startingSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / startingSeconds)) : 0
  const low = ratio < 0.2

  // Count-up animation for the displayed seconds (micro-interaction).
  const [displaySeconds, setDisplaySeconds] = useState(remainingSeconds)
  const fromRef = useRef(remainingSeconds)
  useEffect(() => {
    const from = fromRef.current
    const to = remainingSeconds
    fromRef.current = to
    if (from === to) return
    const duration = 600
    const start = performance.now()
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - (1 - p) ** 3
      setDisplaySeconds(Math.round(from + (to - from) * eased))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [remainingSeconds])

  // Dash: filled portion of the arc. Rotate so it drains from the left end.
  const dashOffset = ARC_LENGTH * (1 - ratio)
  const hoursLeft = Math.floor(renewsIn / 3600)
  const minutesLeft = Math.floor((renewsIn % 3600) / 60)
  const timeLeftLabel = hoursLeft > 0 ? `~ ${hoursLeft}h ${minutesLeft}min` : `~ ${minutesLeft}min`

  return (
    <div className="rounded-2xl bg-panel px-5 py-6">
      <p className="text-center text-sm font-medium text-muted">Resumo do dia</p>

      <div className="relative mx-auto mt-2" style={{ width: SIZE, height: SIZE * 0.82, maxWidth: '100%' }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" style={{ maxHeight: SIZE }}>
          <defs>
            <linearGradient id="gauge-track" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#262833" />
              <stop offset="100%" stopColor="#1d1f27" />
            </linearGradient>
            <linearGradient id="gauge-fill" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor={low ? '#f87171' : '#c4b5fd'} />
              <stop offset="100%" stopColor={low ? '#ef4444' : '#8b5cf6'} />
            </linearGradient>
          </defs>

          {/* track */}
          <path
            d={arcPath()}
            fill="none"
            stroke="url(#gauge-track)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {/* fill — drains as the balance is spent */}
          <path
            d={arcPath()}
            fill="none"
            stroke="url(#gauge-fill)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </svg>

        {/* center readout */}
        <div
          className="absolute inset-x-0 flex flex-col items-center"
          style={{ top: '38%', transform: 'translateY(-50%)' }}
          aria-live="polite"
        >
          <span
            className="text-[44px] leading-none font-bold tracking-tight tabular-nums"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {secondsToHHMMSS(displaySeconds)}
          </span>
          <span className="mt-1.5 text-xs text-muted">saldo investível</span>
        </div>
      </div>

      <p className="-mt-1 text-center text-sm text-muted tabular-nums">
        {timeLeftLabel} até o dia renovar
      </p>
    </div>
  )
}
