// Battery-style balance widget, modeled on the iOS battery reference:
// ⚡ 52% on top, a battery shell with 5 pill cells that drain as the day is
// spent, and "~ Xh" (time until renewal) at the bottom. The charge is the
// day's investible balance: it drops in real time while sessions run and
// everything left dies at renewal.

import { secondsToHHMMSS } from '../engine/timebank'

const CELLS = 5

export function BatteryBalance({
  remainingSeconds,
  startingSeconds,
  renewsIn,
}: {
  remainingSeconds: number
  startingSeconds: number
  renewsIn: number // seconds until the day renews
}) {
  const ratio = startingSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / startingSeconds)) : 0
  const percent = Math.round(ratio * 100)
  const low = ratio < 0.2
  const fillColor = low ? 'bg-danger' : 'bg-gold'
  const glow = low ? 'shadow-[0_0_14px_rgba(255,92,92,0.45)]' : 'shadow-[0_0_14px_rgba(232,197,71,0.4)]'

  const hoursLeft = Math.floor(renewsIn / 3600)
  const minutesLeft = Math.floor((renewsIn % 3600) / 60)
  const timeLeftLabel = hoursLeft > 0 ? `~ ${hoursLeft}h ${minutesLeft}min` : `~ ${minutesLeft}min`

  // Distribute charge across cells; the boundary cell holds a partial pill.
  const exactPerCell = ratio * CELLS
  const cells = Array.from({ length: CELLS }, (_, index) =>
    Math.max(0, Math.min(1, exactPerCell - index)),
  )

  return (
    <div className="rounded-[28px] border border-line bg-panel px-5 py-6">
      {/* charge % */}
      <div className="flex items-center justify-center gap-2" aria-live="polite">
        <svg viewBox="0 0 24 24" className={`h-7 w-7 ${low ? 'text-danger' : 'text-gold'}`} aria-hidden>
          <path fill="currentColor" d="M13 2 4.5 13.5h5L9 22l8.5-11.5h-5L13 2Z" />
        </svg>
        <span
          className="text-[40px] leading-none font-bold tracking-tight text-fg tabular-nums"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {percent}%
        </span>
      </div>

      {/* battery shell with pill cells */}
      <div
        className="mt-5 rounded-[22px] border-2 border-raised bg-ink p-2.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Saldo investível do dia"
      >
        <div className="grid grid-cols-5 gap-2">
          {cells.map((fill, index) => (
            <div key={index} className="relative h-20 overflow-hidden rounded-full bg-raised/50">
              <div
                className={`absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out ${fillColor} ${glow} ${
                  fill < 0.04 ? 'opacity-0' : 'opacity-100'
                }`}
                style={{ height: `${fill * 100}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* live clock + time until renewal, like "~ 2 hours" */}
      <div className="mt-4 text-center">
        <p className="text-sm font-medium text-muted tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {timeLeftLabel}
        </p>
        <p className="mt-0.5 text-[10px] tracking-wide text-muted/70 uppercase">até o dia renovar</p>
        <p className="mt-2 font-mono text-lg font-bold tabular-nums text-fg" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {secondsToHHMMSS(remainingSeconds)}
        </p>
      </div>
    </div>
  )
}
