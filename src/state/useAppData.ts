// React bindings for the observable store + derived selectors.

import { useSyncExternalStore } from 'react'
import type { ActivityTemplate, AppData, DayState, UserSettings } from './types'
import { DEFAULT_TEMPLATES } from './types'
import { getState, isHydrated, subscribe } from './store'
import { computeRemaining, investedSeconds, secondsUntilRenew } from '../engine/timebank'

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getState, getState)
}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isHydrated(),
    () => false,
  )
}

export function selectToday(settings: UserSettings | null, days: Record<string, DayState>): DayState | null {
  if (!settings) return null
  const key = todayKeyFor(settings)
  return days[key] ?? null
}

function todayKeyFor(settings: UserSettings): string {
  // Imported lazily to keep this module import-light; same logic as engine.
  const now = new Date()
  const [h, m] = settings.dayRenewsAt.split(':').map(Number)
  const renewMinutes = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
  const shifted = new Date(now)
  if (now.getHours() * 60 + now.getMinutes() < renewMinutes) shifted.setDate(shifted.getDate() - 1)
  const y = shifted.getFullYear()
  const mo = String(shifted.getMonth() + 1).padStart(2, '0')
  const d = String(shifted.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

export function selectRunningSession(day: DayState | null): DayState['sessions'][number] | null {
  if (!day) return null
  return day.sessions.find((s) => s.status === 'running') ?? null
}

export function selectMergedTemplates(data: AppData): ActivityTemplate[] {
  return [...DEFAULT_TEMPLATES, ...data.customTemplates]
}

export function selectLiveRemaining(day: DayState | null): number {
  if (!day) return 0
  return computeRemaining(day.startingBalanceSeconds, day.sessions)
}

export function selectInvestedToday(day: DayState | null): number {
  if (!day) return 0
  return investedSeconds(day.sessions)
}

export function selectSecondsUntilRenew(settings: UserSettings | null): number {
  if (!settings) return 0
  return secondsUntilRenew(settings.dayRenewsAt)
}
