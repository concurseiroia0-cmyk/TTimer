// Circular gauge modeled on the "Summary / kWp Produced now" reference:
// a thick glowing arc (open at the bottom) that drains as the day's balance
// is spent, a dimmer inner ring showing what was already invested, the big
// value in the center and the renewal countdown INSIDE the arc (so nothing
// overlaps the ring). Sweeps in from empty on mount; counts up smoothly.

import { useEffect, useRef, useState } from 'react'
import { secondsToHHMMSS } from '../engine/timebank'

const SIZE = 260
const STROKE = 20
// Arc geometry: circle radius, exposed from 135° to 405° (270° sweep, gap at bottom).
const RADIUS = (SIZE - STROKE) / 2 - 2
const INNER_STROKE = 9
const INNER_RADIUS = RADIUS - STROKE / 2 - INNER_STROKE - 7
const SWEEP_DEG = 270
const START_ANGLE = 135
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const ARC_LENGTH = (SWEEP_DEG / 360) * CIRCUMFERENCE
const INNER_CIRCUMFERENCE = 2 * Math.PI * INNER_RADIUS
const INNER_ARC_LENGTH = (SWEEP_DEG / 360) * INNER_CIRCUMFERENCE

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(r: number): string {
  const start = polar(SIZE / 2, SIZE / 2, r, START_ANGLE)
  const end = polar(SIZE / 2, SIZE / 2, r, START_ANGLE + SWEEP_DEG)
  return `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`
}

export function SummaryGauge({
  remainingSeconds,
  startingSeconds,
  renewsIn,
  renewLabel,
}: {
  remainingSeconds: number
  startingSeconds: number
  renewsIn: number // seconds until the day renews (clock-melted effective balance)
  renewLabel: string // e.g. "até o dia renovar" — rendered INSIDE the arc
}) {
  const ratio = renewsIn > 0 ? Math.max(0, Math.min(1, remainingSeconds / Math.max(1, startingSeconds))) : 0
  const investedRatio = startingSeconds > 0 ? Math.max(0, Math.min(1, 1 - ratio)) : 0
  const low = renewsIn > 0 && ratio < 0.2

  // Mount sweep: both arcs grow in from empty on the first frames.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Count-up animation for the displayed seconds (micro-interaction).
  const [displaySeconds, setDisplaySeconds] = useState(remainingSeconds)
  const fromRef = useRef(remainingSeconds)
  useEffect(() => {
    const from = fromRef.current
    const to = remainingSeconds
    fromRef.current = to
    if (from === to) return
    const duration = 500
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

  // Dash offsets: outer = effective (clock-melted) balance, inner = invested.
  const fillOffset = mounted ? ARC_LENGTH * (1 - ratio) : ARC_LENGTH
  const innerOffset = mounted ? INNER_ARC_LENGTH * (1 - investedRatio) : INNER_ARC_LENGTH

  const fillFrom = low ? '#f87171' : '#c4b5fd'
  const fillTo = low ? '#ef4444' : '#8b5cf6'
  const innerColor = low ? 'rgba(239, 68, 68, 0.32)' : 'rgba(139, 92, 246, 0.30)'

  return (
    <div className="rounded-2xl bg-panel px-4 py-5">
      <p className="text-center text-sm font-medium text-muted">Resumo do dia</p>

      <div className="relative mx-auto mt-1" style={{ width: SIZE, height: SIZE * 0.82, maxWidth: '100%' }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" style={{ maxHeight: SIZE }}>
          <defs>
            <linearGradient id="gauge-track" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#262833" />
              <stop offset="100%" stopColor="#1d1f27" />
            </linearGradient>
            <linearGradient id="gauge-fill" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor={fillFrom} />
              <stop offset="100%" stopColor={fillTo} />
            </linearGradient>
            {/* Soft neon glow behind the arc, like the reference */}
            <filter id="gauge-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
          </defs>

          {/* glow (blurred copy of the fill, behind everything) */}
          <path
            d={arcPath(RADIUS)}
            fill="none"
            stroke={fillTo}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
            strokeDashoffset={fillOffset}
            filter="url(#gauge-glow)"
            opacity={0.5}
            style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
          {/* track */}
          <path
            d={arcPath(RADIUS)}
            fill="none"
            stroke="url(#gauge-track)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {/* inner ring: time already invested */}
          <path
            d={arcPath(INNER_RADIUS)}
            fill="none"
            stroke={innerColor}
            strokeWidth={INNER_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${INNER_ARC_LENGTH} ${INNER_CIRCUMFERENCE}`}
            strokeDashoffset={innerOffset}
            style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
          {/* fill — the clock-melted effective balance */}
          <path
            d={arcPath(RADIUS)}
            fill="none"
            stroke="url(#gauge-fill)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
            strokeDashoffset={fillOffset}
            style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </svg>

        {/* Center readout: value + caption INSIDE the arc — nothing overlaps the ring */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pb-6"
          aria-live="polite"
        >
          <span
            className="text-[44px] leading-none font-bold tracking-tight"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {secondsToHHMMSS(displaySeconds)}
          </span>
          <span className="mt-1.5 text-xs text-muted">saldo investível</span>
          <span className="mt-2 rounded-full bg-raised/70 px-3 py-1 text-[11px] font-medium tabular-nums text-muted">
            ⏳ {renewLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
