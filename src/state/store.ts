// Single source of truth for app data: versioned localStorage ("timebank:v1")
// wrapped in a tiny observable store consumed via useSyncExternalStore.
//
// The live 1s balance countdown and background catch-up run on a global
// scheduler here (not inside components), so timers keep correct time even
// while the user navigates between screens.

import type { ActivityTemplate, AppData, DeadTimeLabel, DayState, Session, UserSettings } from './types'
import {
  computeStartingBalance,
  createSession,
  todayDateKey,
  applyTick,
  catchUpAfterBackground,
  abandonSession,
  pauseSession,
  resumeSession,
} from '../engine/timebank'
import { emptyData, loadData, saveData, STORAGE_KEY } from './storage'

type Listener = () => void

interface Store {
  data: AppData
}

let state: Store = { data: emptyData() }
const listeners = new Set<Listener>()
let hydrated = false

// --- scheduling -------------------------------------------------------------
let tickIntervalId: number | null = null
let renewalTimeoutId: number | null = null
let saveCounter = 0

function notify(): void {
  for (const listener of listeners) listener()
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getState(): AppData {
  return state.data
}

export function isHydrated(): boolean {
  return hydrated
}

function setData(updater: (data: AppData) => AppData): void {
  state.data = updater(state.data)
  saveCounter += 1
  // Persist at least every 5 mutations and on lifecycle events (engine rule).
  if (saveCounter % 5 === 0) saveData(state.data)
  notify()
}

export function flushPersist(): void {
  saveData(state.data)
}

// --- hydration / bootstrap ---------------------------------------------------

export function hydrate(nowMs: number = Date.now()): void {
  state.data = loadData()
  hydrated = true
  bootstrapDay(nowMs)
  startScheduler()
}

/** Create today's DayState, catch up any running session, schedule renewal. */
export function bootstrapDay(nowMs: number = Date.now()): void {
  const data = state.data
  if (!data.settings) {
    notify()
    return
  }

  const dateKey = todayDateKey(data.settings.dayRenewsAt, nowMs)
  const starting = computeStartingBalance(data.settings)

  let days = { ...data.days }
  let day = days[dateKey]

  if (!day) {
    // Fresh day: expire yesterday's leftover balance (it is simply not carried).
    day = {
      dateKey,
      startingBalanceSeconds: starting,
      remainingBalanceSeconds: starting,
      sessions: [],
      deadTime: [],
    }
    days = { ...days, [dateKey]: day }
  } else {
    // Recompute starting balance from current settings; do not rewrite past
    // days — recalculating today only, from now on.
    day = { ...day, startingBalanceSeconds: starting }
  }

  // Freeze yesterday: sessions that were still running/paused on previous days
  // are abandoned as-is — their leftover balance expired with the day.
  for (const key of Object.keys(days)) {
    if (key === dateKey) continue
    const other = days[key]
    if (other.sessions.some((s) => s.status === 'running' || s.status === 'paused')) {
      days[key] = {
        ...other,
        sessions: other.sessions.map((s) =>
          s.status === 'running' || s.status === 'paused'
            ? { ...s, status: 'abandoned' as const, endedAt: new Date(nowMs).toISOString() }
            : s,
        ),
      }
    }
  }

  // Catch up running sessions after background / app close (timestamp diff).
  const catchUp = catchUpAfterBackground({ ...day, lastTickAt: day.lastTickAt }, nowMs)
  day = catchUp.day

  setData((current) => ({
    ...current,
    days,
    lifetimeInvestedSeconds: recomputeLifetimeInvested({ ...current, days }),
    completedSessions: countCompletedSessions({ ...current, days }),
  }))

  scheduleRenewal()
}

function recomputeLifetimeInvested(data: AppData): number {
  let total = 0
  for (const day of Object.values(data.days)) {
    for (const session of day.sessions) total += session.elapsedSeconds
  }
  return total
}

function countCompletedSessions(data: AppData): number {
  let count = 0
  for (const day of Object.values(data.days)) {
    for (const session of day.sessions) {
      if (session.status === 'completed') count += 1
    }
  }
  return count
}

// --- global 1s scheduler ------------------------------------------------------

const TICK_MS = 1000

function startScheduler(): void {
  if (tickIntervalId != null) return
  tickIntervalId = window.setInterval(() => {
    runTick()
  }, TICK_MS)
  window.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('beforeunload', flushPersist)
  scheduleRenewal()
}

function runTick(): void {
  const data = state.data
  if (!data.settings || !data.onboarded) return
  const dateKey = todayDateKey(data.settings.dayRenewsAt)
  const day = data.days[dateKey]
  if (!day) return
  if (!day.sessions.some((s) => s.status === 'running')) {
    // Still record lastTickAt occasionally so catch-up stays anchored.
    return
  }
  const result = applyTick(day, Date.now())
  setData((current) => {
    const days = { ...current.days, [dateKey]: result.day }
    return {
      ...current,
      days,
      lifetimeInvestedSeconds: recomputeLifetimeInvested({ ...current, days }),
      completedSessions: countCompletedSessions({ ...current, days }),
    }
  })
  if (result.stopped && result.stopReason === 'balance-exhausted') {
    notifyExhausted()
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    bootstrapDay() // catch-up on return
  }
  flushPersist()
}

// --- day renewal -------------------------------------------------------------

function scheduleRenewal(): void {
  if (renewalTimeoutId != null) {
    window.clearTimeout(renewalTimeoutId)
    renewalTimeoutId = null
  }
  const data = state.data
  if (!data.settings) return
  const ms = msUntilRenewSafe(data.settings.dayRenewsAt)
  renewalTimeoutId = window.setTimeout(() => {
    bootstrapDay()
    notifyRenewal()
  }, Math.min(ms + 1000, 2 ** 31 - 1))
}

function msUntilRenewSafe(dayRenewsAt: string): number {
  const renew = parseHHmm(dayRenewsAt) ?? 0
  const now = new Date()
  const next = new Date(now)
  next.setHours(Math.floor(renew / 60), renew % 60, 0, 0)
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1)
  return next.getTime() - Date.now()
}

function parseHHmm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

// --- actions -------------------------------------------------------------------

export function completeOnboarding(settings: UserSettings): void {
  setData((data) => ({ ...data, settings, onboarded: true }))
  bootstrapDay()
}

export function updateSettings(settings: UserSettings): void {
  setData((data) => ({ ...data, settings }))
  // Recalculate today from now on; past days are never rewritten.
  bootstrapDay()
}

export function startSession(input: {
  activityId: string
  activityName: string
  emoji: string
  plannedSeconds: number
}): Session | null {
  const data = state.data
  if (!data.settings) return null
  const nowMs = Date.now()
  const dateKey = todayDateKey(data.settings.dayRenewsAt, nowMs)
  let day = data.days[dateKey]
  if (!day) {
    bootstrapDay(nowMs)
    day = state.data.days[dateKey]
    if (!day) return null
  }

  const remaining = computeRemainingSafe(day)
  if (input.plannedSeconds > remaining) return null // blocked at UI level too

  const session = createSession({
    id: `s_${nowMs}_${Math.random().toString(36).slice(2, 8)}`,
    dateKey,
    activityId: input.activityId,
    activityName: input.activityName,
    emoji: input.emoji,
    plannedSeconds: input.plannedSeconds,
    nowMs,
  })

  const updatedDay: DayState = {
    ...day,
    sessions: [...day.sessions, session],
    lastTickAt: new Date(nowMs).toISOString(),
  }
  setData((current) => ({ ...current, days: { ...current.days, [dateKey]: updatedDay } }))
  return session
}

function computeRemainingSafe(day: DayState): number {
  const invested = day.sessions.reduce((total, s) => total + Math.max(0, Math.floor(s.elapsedSeconds)), 0)
  return Math.max(0, day.startingBalanceSeconds - invested)
}

export function pauseSessionById(sessionId: string): void {
  const data = state.data
  if (!data.settings) return
  const dateKey = todayDateKey(data.settings.dayRenewsAt)
  const day = data.days[dateKey]
  if (!day) return
  const updated = pauseSession(day, sessionId, Date.now())
  setData((current) => ({ ...current, days: { ...current.days, [dateKey]: updated } }))
}

export function resumeSessionById(sessionId: string): void {
  const data = state.data
  if (!data.settings) return
  const dateKey = todayDateKey(data.settings.dayRenewsAt)
  const day = data.days[dateKey]
  if (!day) return
  const updated = resumeSession(day, sessionId, Date.now())
  setData((current) => ({ ...current, days: { ...current.days, [dateKey]: updated } }))
}

export function abandonSessionById(sessionId: string): void {
  const data = state.data
  if (!data.settings) return
  const dateKey = todayDateKey(data.settings.dayRenewsAt)
  const day = data.days[dateKey]
  if (!day) return
  const updated = abandonSession(day, sessionId, Date.now())
  setData((current) => ({ ...current, days: { ...current.days, [dateKey]: updated } }))
}

export function addCustomTemplate(template: Omit<ActivityTemplate, 'isCustom'>): ActivityTemplate {
  const full: ActivityTemplate = { ...template, isCustom: true }
  setData((data) => ({ ...data, customTemplates: [...data.customTemplates, full] }))
  return full
}

export function addDeadTime(label: DeadTimeLabel, seconds: number): void {
  const data = state.data
  if (!data.settings) return
  const nowMs = Date.now()
  const dateKey = todayDateKey(data.settings.dayRenewsAt, nowMs)
  let day = data.days[dateKey]
  if (!day) {
    bootstrapDay(nowMs)
    day = state.data.days[dateKey]
    if (!day) return
  }
  const updatedDay: DayState = {
    ...day,
    deadTime: [
      ...day.deadTime,
      { id: `dt_${nowMs}_${Math.random().toString(36).slice(2, 8)}`, dateKey, label, seconds },
    ],
  }
  setData((current) => ({ ...current, days: { ...current.days, [dateKey]: updatedDay } }))
}

export function setNightReflection(dateKey: string, text: string): void {
  setData((current) => {
    const day = current.days[dateKey]
    if (!day) return current
    return {
      ...current,
      days: { ...current.days, [dateKey]: { ...day, nightReflection: text } },
    }
  })
}

export function resetAllData(): void {
  state.data = emptyData()
  saveData(state.data)
  notify()
  stopScheduler()
  hydrated = true
}

function stopScheduler(): void {
  if (tickIntervalId != null) {
    window.clearInterval(tickIntervalId)
    tickIntervalId = null
  }
  if (renewalTimeoutId != null) {
    window.clearTimeout(renewalTimeoutId)
    renewalTimeoutId = null
  }
}

// --- event hooks for UI banners/notifications -----------------------------------

type AppEvent =
  | { type: 'balance-exhausted' }
  | { type: 'day-renewed'; balanceSeconds: number }
  | { type: 'session-completed'; activityName: string }

let lastEvent: AppEvent | null = null
const eventListeners = new Set<(event: AppEvent) => void>()

export function onAppEvent(listener: (event: AppEvent) => void): () => void {
  eventListeners.add(listener)
  return () => eventListeners.delete(listener)
}

function emitEvent(event: AppEvent): void {
  lastEvent = event
  for (const listener of eventListeners) listener(event)
}

export function getLastEvent(): AppEvent | null {
  return lastEvent
}

function notifyExhausted(): void {
  emitEvent({ type: 'balance-exhausted' })
}

function notifyRenewal(): void {
  const data = state.data
  const starting = data.settings ? computeStartingBalance(data.settings) : 0
  emitEvent({ type: 'day-renewed', balanceSeconds: starting })
}

export function notifySessionCompleted(activityName: string): void {
  emitEvent({ type: 'session-completed', activityName })
}

export function currentStorageKey(): string {
  return STORAGE_KEY
}
