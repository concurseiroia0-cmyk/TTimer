// Minimalist top bar: big page title on the left, compact live balance chip
// on the right — iOS 26 liquid glass, matching the bottom nav material.

import { secondsToHHMMSS } from '../engine/timebank'

export function BalanceHeader({
  title,
  remainingSeconds,
  renewsIn,
  onClick,
}: {
  title: string
  remainingSeconds: number
  renewsIn: number // seconds until renewal
  onClick?: () => void
}) {
  const hours = Math.floor(renewsIn / 3600)
  const minutes = Math.floor((renewsIn % 3600) / 60)
  return (
    <header className="sticky top-0 z-20 px-4 pt-[max(env(safe-area-inset-top),14px)] pb-3">
      <div className="glass-nav flex items-center justify-between gap-3 rounded-full py-2 pr-2 pl-5 backdrop-blur-2xl backdrop-saturate-150">
        <h1 className="text-[24px] leading-tight font-bold tracking-tight">{title}</h1>
        <button
          onClick={onClick}
          className="tap-target flex items-center gap-2 rounded-full bg-raised/60 px-3.5 py-2 text-right transition-colors active:scale-[0.98]"
          aria-label="Saldo investível e renovação do dia"
        >
          <span className="flex flex-col items-end leading-none">
            <span className="font-mono text-sm font-bold tabular-nums text-accent">{secondsToHHMMSS(remainingSeconds)}</span>
            <span className="mt-0.5 text-[10px] text-muted">renova {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}</span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-muted">
            <path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12L13 3Z" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </header>
  )
}
