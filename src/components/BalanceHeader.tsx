// Top bar with the always-visible live remaining balance (widget-like header).

import { secondsToHHMMSS } from '../engine/timebank'

export function BalanceHeader({
  name,
  remainingSeconds,
  renewsIn,
  onClick,
}: {
  name: string | null
  remainingSeconds: number
  renewsIn: number // seconds until renewal
  onClick?: () => void
}) {
  const hours = Math.floor(renewsIn / 3600)
  const minutes = Math.floor((renewsIn % 3600) / 60)
  return (
    <header className="sticky top-0 z-20 border-b border-line/60 bg-ink/80 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] tracking-wide text-muted uppercase">Saldo investível</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-accent" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {secondsToHHMMSS(remainingSeconds)}
          </p>
        </div>
        <button
          onClick={onClick}
          className="tap-target rounded-xl border border-line bg-panel px-3 py-1.5 text-right text-[11px] leading-tight text-muted transition-colors hover:border-accent/40"
        >
          {name ? <span className="block max-w-[120px] truncate text-fg">{name}</span> : null}
          <span className="block">renova em {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}</span>
        </button>
      </div>
    </header>
  )
}
