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
  const fillColor = low ? 'bg-danger' : 'bg-accent'

  const hoursLeft = Math.floor(renewsIn / 3600)
  const minutesLeft = Math.floor((renewsIn % 3600) / 60)
  const timeLeftLabel = hoursLeft > 0 ? `~ ${hoursLeft}h ${minutesLeft}min` : `~ ${minutesLeft}min`

  // Distribute charge across cells; the boundary cell holds a partial pill.
  const exactPerCell = ratio * CELLS
  const cells = Array.from({ length: CELLS }, (_, index) =>
    Math.max(0, Math.min(1, exactPerCell - index)),
  )

  return (
    <div className="rounded-2xl bg-panel px-5 py-5">
      {/* charge: big number left, cells right — quiet and flat */}
      <div className="flex items-center justify-between" aria-live="polite">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl leading-none font-bold tracking-tight tabular-nums">{percent}</span>
          <span className="text-lg font-semibold text-muted">%</span>
        </div>
        <svg viewBox="0 0 24 24" className={`h-5 w-5 ${low ? 'text-danger' : 'text-accent'}`} aria-hidden>
          <path fill="currentColor" d="M13 2 4.5 13.5h5L9 22l8.5-11.5h-5L13 2Z" />
        </svg>
      </div>

      {/* battery: 5 flat cells that drain bottom-up */}
      <div
        className="mt-4 grid grid-cols-5 gap-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Saldo investível do dia"
      >
        {cells.map((fill, index) => (
          <div key={index} className="relative h-12 overflow-hidden rounded-lg bg-raised/40">
            <div
              className={`absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out ${fillColor} ${
                fill < 0.04 ? 'opacity-0' : 'opacity-100'
              }`}
              style={{ height: `${fill * 100}%` }}
            />
          </div>
        ))}
      </div>

      {/* footer: renewal countdown + exact live clock */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-sm text-muted tabular-nums">{timeLeftLabel} até renovar</p>
        <p className="font-mono text-sm font-semibold tabular-nums text-fg">{secondsToHHMMSS(remainingSeconds)}</p>
      </div>
    </div>
  )
}
