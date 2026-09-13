// Shared UI primitives for the TimeBank design system.

import { useEffect, useState } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

// --- time -------------------------------------------------------------------

/** Re-renders once per second; returns a stable "now" timestamp each tick. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

// --- layout -------------------------------------------------------------------

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-line bg-panel/90 p-4 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_10px_30px_-18px_rgba(0,0,0,0.8)] ${className}`}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <h2 className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{children}</h2>
      {action}
    </div>
  )
}

// --- buttons -------------------------------------------------------------------

type ButtonVariant = 'gold' | 'ghost' | 'danger' | 'success'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  block?: boolean
}

const VARIANTS: Record<ButtonVariant, string> = {
  gold: 'bg-gold text-ink hover:bg-gold-soft active:bg-gold-soft font-semibold shadow-[0_8px_24px_-12px_rgba(232,197,71,0.7)]',
  ghost: 'bg-raised text-fg border border-line hover:border-muted/50',
  danger: 'bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25',
  success: 'bg-success/15 text-success border border-success/40 hover:bg-success/25',
}

export function Button({ variant = 'ghost', block, className = '', ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={`tap-target inline-flex items-center justify-center gap-2 rounded-xl px-4 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`}
    />
  )
}

// --- inputs -------------------------------------------------------------------

export function TextField({
  label,
  hint,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block px-1 text-sm font-medium text-muted">{label}</span>}
      <input
        {...rest}
        className={`tap-target w-full rounded-xl border border-line bg-raised px-4 text-base text-fg outline-none placeholder:text-muted/60 focus:border-gold/60 ${className}`}
      />
      {hint && <span className="mt-1 block px-1 text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function TimeField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-sm font-medium text-muted">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="tap-target w-full rounded-xl border border-line bg-raised px-4 text-base text-fg outline-none focus:border-gold/60"
      />
      {hint && <span className="mt-1 block px-1 text-xs text-muted">{hint}</span>}
    </label>
  )
}

// --- balance bar -------------------------------------------------------------------

export function BalanceBar({
  ratio,
  tone = 'gold',
}: {
  ratio: number // 0..1
  tone?: 'gold' | 'success' | 'danger'
}) {
  const clamped = Math.max(0, Math.min(1, ratio))
  const color = tone === 'gold' ? 'bg-gold' : tone === 'success' ? 'bg-success' : 'bg-danger'
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-raised">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${color}`}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}

// --- misc -------------------------------------------------------------------

export function Motto({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-[11px] tracking-wide text-muted/80 ${className}`}>
      Você não gasta tempo. Você investe tempo.
    </p>
  )
}

export function StatusIcon({ status }: { status: 'running' | 'paused' | 'completed' | 'abandoned' }) {
  if (status === 'completed') return <span title="concluído">✅</span>
  if (status === 'running') return <span title="em andamento">🔄</span>
  if (status === 'paused') return <span title="pausado">⏸️</span>
  return <span title="abandonou">⚠️</span>
}

export function EmptyState({
  emoji,
  title,
  description,
  action,
}: {
  emoji: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-8 text-center">
      <span className="text-3xl" aria-hidden>
        {emoji}
      </span>
      <p className="text-sm font-semibold text-fg">{title}</p>
      <p className="max-w-[46ch] text-sm text-muted">{description}</p>
      {action}
    </div>
  )
}
