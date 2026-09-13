// TimeBank balance engine — pure functions only, no DOM, no storage.
// All time math derives from timestamps (never setInterval += 1), so the
// displayed timer never drifts and reopening the app catches up correctly.

export interface WeeklyGoal {
  activityId: string
  minutes: number
}

export interface UserSettings {
  name: string
  sleepStart: string // "HH:mm"
  wakeTime: string // "HH:mm"
  workHoursPerDay: number
  mealsHygieneHours: number
  dayRenewsAt: string // "HH:mm", usually == wakeTime
  weeklyGoals?: WeeklyGoal[]
}

export type SessionStatus = 'running' | 'paused' | 'completed' | 'abandoned'

export interface Session {
  id: string
  dateKey: string
  activityId: string
  activityName: string
  emoji: string
  plannedSeconds: number
  elapsedSeconds: number
  status: SessionStatus
  startedAt: string
  endedAt?: string
}

export type DeadTimeLabel = 'Redes sociais' | 'Jogos' | 'Séries' | 'Outro'

export interface DeadTimeEntry {
  id: string
  dateKey: string
  label: DeadTimeLabel
  seconds: number
}

export interface DayState {
  dateKey: string
  startingBalanceSeconds: number
  remainingBalanceSeconds: number
  sessions: Session[]
  deadTime: DeadTimeEntry[]
  nightReflection?: string
  lastTickAt?: string
}

// ---------------------------------------------------------------------------
// HH:mm parsing / duration math
// ---------------------------------------------------------------------------

/** Parse "HH:mm" into total minutes [0, 1440). Returns null when invalid. */
export function parseHHmm(value: string): number | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/** Parse "HH:mm" or "H:mm" style durations like "08:30" into seconds. */
export function hhmmToSeconds(value: string): number {
  const totalMinutes = parseHHmm(value)
  if (totalMinutes == null) return 0
  return totalMinutes * 60
}

/** Seconds -> "HH:MM" (hours can exceed 24, always floored). */
export function secondsToHHmm(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** Seconds -> "HH:MM:SS" (hours can exceed 24). */
export function secondsToHHMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Sleep duration (sleepStart may cross midnight relative to wakeTime)
// ---------------------------------------------------------------------------

/**
 * Sleep duration in seconds between sleepStart and wakeTime.
 * Handles wake after midnight (22:00 -> 06:00 = 8h) and same-day sleep
 * (06:00 -> 07:30 = 1h30). Returns 0 when the window is empty/invalid.
 */
export function computeSleepDuration(sleepStart: string, wakeTime: string): number {
  const start = parseHHmm(sleepStart)
  const wake = parseHHmm(wakeTime)
  if (start == null || wake == null) return 0
  let diffMinutes = wake - start
  if (diffMinutes <= 0) diffMinutes += 24 * 60 // crossed midnight
  return diffMinutes * 60
}

/** Human sleep duration as "Hh MMmin" or "MMmin". */
export function sleepDurationLabel(sleepStart: string, wakeTime: string): string {
  const seconds = computeSleepDuration(sleepStart, wakeTime)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours === 0) return `${minutes}min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${String(minutes).padStart(2, '0')}min`
}

// ---------------------------------------------------------------------------
// Settings validation
// ---------------------------------------------------------------------------

export interface SettingsValidation {
  ok: boolean
  errors: string[]
  sleepSeconds: number
  busySeconds: number // sleep + work + meals
}

/** A day is valid when all fields parse and busy time stays under 24h. */
export function validateSettings(
  settings: Pick<
    UserSettings,
    'sleepStart' | 'wakeTime' | 'workHoursPerDay' | 'mealsHygieneHours' | 'dayRenewsAt'
  >,
): SettingsValidation {
  const errors: string[] = []
  const sleepSeconds = computeSleepDuration(settings.sleepStart, settings.wakeTime)
  const workSeconds = Math.max(0, Number(settings.workHoursPerDay) || 0) * 3600
  const mealsSeconds = Math.max(0, Number(settings.mealsHygieneHours) || 0) * 3600

  if (parseHHmm(settings.sleepStart) == null) errors.push('Horário de dormir inválido.')
  if (parseHHmm(settings.wakeTime) == null) errors.push('Horário de acordar inválido.')
  if (parseHHmm(settings.dayRenewsAt) == null) errors.push('Horário de renovação inválido.')
  if (sleepSeconds <= 0) errors.push('Duração do sono precisa ser maior que zero.')
  if (workSeconds <= 0) errors.push('Horas de trabalho precisam ser maiores que zero.')
  if (mealsSeconds <= 0) errors.push('Horas de refeições/higiene precisam ser maiores que zero.')

  const busySeconds = sleepSeconds + workSeconds + mealsSeconds
  if (busySeconds >= 24 * 3600) {
    errors.push('Sono + trabalho + refeições não podem fechar as 24h do dia.')
  }

  return { ok: errors.length === 0, errors, sleepSeconds, busySeconds }
}

// ---------------------------------------------------------------------------
// Daily balance
// ---------------------------------------------------------------------------

/** dailyBalanceSeconds = 24h - sleep - work - meals (never negative). */
export function computeStartingBalance(settings: UserSettings): number {
  const validation = validateSettings(settings)
  if (!validation.ok) return 0
  return 24 * 3600 - validation.busySeconds
}

// ---------------------------------------------------------------------------
// Date keys — the day renews at settings.dayRenewsAt, not at midnight
// ---------------------------------------------------------------------------

function localWallClockMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/**
 * The dateKey (YYYY-MM-DD, local timezone) a timestamp belongs to.
 * The day "renews" at dayRenewsAt: instants before that hour belong to the
 * previous calendar day. Example: renew 06:00 → 05:59 is still "yesterday".
 */
export function computeDateKey(timestampMs: number, dayRenewsAt: string): string {
  const renewMinutes = parseHHmm(dayRenewsAt) ?? 0
  const date = new Date(timestampMs)
  const nowMinutes = localWallClockMinutes(date)
  const shifted = new Date(date)
  if (nowMinutes < renewMinutes) {
    shifted.setDate(shifted.getDate() - 1)
  }
  const year = shifted.getFullYear()
  const month = String(shifted.getMonth() + 1).padStart(2, '0')
  const day = String(shifted.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** dateKey of "today" for the given renew hour. */
export function todayDateKey(dayRenewsAt: string, nowMs: number = Date.now()): string {
  return computeDateKey(nowMs, dayRenewsAt)
}

/** Milliseconds until the next renew (day rollover) from `nowMs`. */
export function msUntilRenew(dayRenewsAt: string, nowMs: number = Date.now()): number {
  const renewMinutes = parseHHmm(dayRenewsAt) ?? 0
  const now = new Date(nowMs)
  const next = new Date(now)
  next.setHours(Math.floor(renewMinutes / 60), renewMinutes % 60, 0, 0)
  if (next.getTime() <= nowMs) next.setDate(next.getDate() + 1)
  return next.getTime() - nowMs
}

/** Seconds until the day expires (same as msUntilRenew, in seconds). */
export function secondsUntilRenew(dayRenewsAt: string, nowMs: number = Date.now()): number {
  return Math.floor(msUntilRenew(dayRenewsAt, nowMs) / 1000)
}

// ---------------------------------------------------------------------------
// Balance arithmetic
// ---------------------------------------------------------------------------

/** Spent seconds of a single session (elapsed while running/paused/done). */
export function sessionSpentSeconds(session: Session): number {
  return Math.max(0, Math.floor(session.elapsedSeconds))
}

/** Total seconds spent across sessions (completed, abandoned, paused, running). */
export function investedSeconds(sessions: Session[]): number {
  return sessions.reduce((total, session) => total + sessionSpentSeconds(session), 0)
}

/** remaining = starting - invested, never below zero. */
export function computeRemaining(startingBalanceSeconds: number, sessions: Session[]): number {
  const remaining = startingBalanceSeconds - investedSeconds(sessions)
  return Math.max(0, remaining)
}

/**
 * Effective available balance: the smaller of what the ledger says and how
 * much wall-clock time is left before the day expires. The balance "melts"
 * in real time as the day's clock runs down — time not invested evaporates.
 * Example: 6h of ledger balance at 21:00 (3h left until 00:00) → 3h effective.
 */
export function effectiveBalanceSeconds(
  startingBalanceSeconds: number,
  sessions: Session[],
  secondsUntilRenew: number,
): number {
  const ledger = computeRemaining(startingBalanceSeconds, sessions)
  return Math.max(0, Math.min(ledger, Math.max(0, secondsUntilRenew)))
}

// ---------------------------------------------------------------------------
// Ticking — always derived from wall-clock timestamps (no drift)
// ---------------------------------------------------------------------------

export interface TickResult {
  day: DayState
  /** true when the running session consumed the session plan or the balance. */
  stopped: boolean
  stopReason?: 'session-complete' | 'balance-exhausted'
}

/**
 * Advance a running session from `day.lastTickAt` (or `nowMs` on first tick)
 * to `nowMs` based on timestamp difference — immune to interval drift and to
 * throttled background tabs. Never exceeds plannedSeconds and never drives
 * remaining below zero. Auto-stops on session completion or empty balance.
 */
export function applyTick(day: DayState, nowMs: number): TickResult {
  const lastTickAt = day.lastTickAt ? Date.parse(day.lastTickAt) : nowMs
  const elapsedRealMs = Math.max(0, nowMs - lastTickAt)

  const sessionIndex = day.sessions.findIndex((s) => s.status === 'running')
  if (sessionIndex === -1 || elapsedRealMs < 500) {
    return { day: { ...day, lastTickAt: new Date(nowMs).toISOString() }, stopped: false }
  }

  const startingBalance = day.startingBalanceSeconds
  const sessions = [...day.sessions]
  const session = { ...sessions[sessionIndex] }

  const remainingBefore = computeRemaining(startingBalance, sessions)
  const sessionRemaining = Math.max(0, session.plannedSeconds - session.elapsedSeconds)
  const secondsToApply = Math.min(Math.floor(elapsedRealMs / 1000), sessionRemaining, remainingBefore)

  if (secondsToApply > 0) {
    session.elapsedSeconds = Math.min(session.plannedSeconds, session.elapsedSeconds + secondsToApply)
  }
  session.endedAt = new Date(nowMs).toISOString()
  sessions[sessionIndex] = session

  const remainingAfter = computeRemaining(startingBalance, sessions)
  const sessionDone = session.elapsedSeconds >= session.plannedSeconds

  let stopped = false
  let stopReason: TickResult['stopReason']
  if (sessionDone) {
    session.status = 'completed'
    sessions[sessionIndex] = { ...session, endedAt: new Date(nowMs).toISOString() }
    stopped = true
    stopReason = 'session-complete'
  } else if (remainingAfter <= 0) {
    session.status = 'abandoned'
    sessions[sessionIndex] = { ...session, endedAt: new Date(nowMs).toISOString() }
    stopped = true
    stopReason = 'balance-exhausted'
  }

  return {
    day: {
      ...day,
      sessions,
      remainingBalanceSeconds: computeRemaining(startingBalance, sessions),
      lastTickAt: new Date(nowMs).toISOString(),
    },
    stopped,
    stopReason,
  }
}

/**
 * Reopen-catch-up: the app was closed (or backgrounded) while a session ran.
 * Charges real elapsed time via timestamps, capped by plannedSeconds and by
 * remaining balance, then completes / abandons / resumes accordingly.
 */
export function catchUpAfterBackground(day: DayState, nowMs: number): TickResult {
  return applyTick(day, nowMs)
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

export function createSession(input: {
  id: string
  dateKey: string
  activityId: string
  activityName: string
  emoji: string
  plannedSeconds: number
  nowMs: number
}): Session {
  return {
    id: input.id,
    dateKey: input.dateKey,
    activityId: input.activityId,
    activityName: input.activityName,
    emoji: input.emoji,
    plannedSeconds: input.plannedSeconds,
    elapsedSeconds: 0,
    status: 'running',
    startedAt: new Date(input.nowMs).toISOString(),
  }
}

export function pauseSession(day: DayState, sessionId: string, nowMs: number): DayState {
  const ticked = applyTick(day, nowMs).day
  return {
    ...ticked,
    sessions: ticked.sessions.map((s) => (s.id === sessionId && s.status === 'running' ? { ...s, status: 'paused' } : s)),
  }
}

export function resumeSession(day: DayState, sessionId: string, nowMs: number): DayState {
  return {
    ...day,
    sessions: day.sessions.map((s) => (s.id === sessionId && s.status === 'paused' ? { ...s, status: 'running' } : s)),
    lastTickAt: new Date(nowMs).toISOString(),
  }
}

/** End early: keep elapsed as spent, mark abandoned when not completed. */
export function abandonSession(day: DayState, sessionId: string, nowMs: number): DayState {
  const ticked = applyTick(day, nowMs).day
  return {
    ...ticked,
    sessions: ticked.sessions.map((s) =>
      s.id === sessionId && (s.status === 'running' || s.status === 'paused')
        ? { ...s, status: 'abandoned', endedAt: new Date(nowMs).toISOString() }
        : s,
    ),
  }
}

// ---------------------------------------------------------------------------
// Day renewal
// ---------------------------------------------------------------------------

/** Freeze yesterday implicitly; create a fresh DayState with full balance. */
export function createDayState(dateKey: string, startingBalanceSeconds: number): DayState {
  return {
    dateKey,
    startingBalanceSeconds,
    remainingBalanceSeconds: startingBalanceSeconds,
    sessions: [],
    deadTime: [],
  }
}

// ---------------------------------------------------------------------------
// Dead time + summaries
// ---------------------------------------------------------------------------

export function deadTimeSeconds(day: DayState): number {
  return day.deadTime.reduce((total, entry) => total + entry.seconds, 0)
}

export interface DaySummary {
  investedSeconds: number
  deadSeconds: number
  wastedSeconds: number // unused balance that expired
  startingBalanceSeconds: number
  remainingBalanceSeconds: number
  investedRatio: number
}

export function summarizeDay(day: DayState): DaySummary {
  const invested = investedSeconds(day.sessions)
  const dead = deadTimeSeconds(day)
  const wasted = Math.max(0, day.startingBalanceSeconds - invested)
  return {
    investedSeconds: invested,
    deadSeconds: dead,
    wastedSeconds: wasted,
    startingBalanceSeconds: day.startingBalanceSeconds,
    remainingBalanceSeconds: Math.max(0, day.remainingBalanceSeconds),
    investedRatio: day.startingBalanceSeconds > 0 ? Math.min(1, invested / day.startingBalanceSeconds) : 0,
  }
}

// ---------------------------------------------------------------------------
// Gamification
// ---------------------------------------------------------------------------

/** 1 evolution coin per full invested hour (floor of lifetime hours). */
export function evolutionCoins(totalInvestedSecondsLifetime: number): number {
  return Math.floor(Math.max(0, totalInvestedSecondsLifetime) / 3600)
}

export function isDayStreakDay(day: DayState): boolean {
  if (day.startingBalanceSeconds <= 0) return false
  return investedSeconds(day.sessions) >= day.startingBalanceSeconds * 0.3
}

/** Consecutive days (walking back from `endDateKey`) with ≥30% invested. */
export function computeStreak(days: DayState[], endDateKey: string): number {
  const byKey = new Map(days.map((d) => [d.dateKey, d]))
  let streak = 0
  let cursor = endDateKey
  // Walk back day by day; stop at the first missing/weak day.
  for (let i = 0; i < 3650; i++) {
    const day = byKey.get(cursor)
    if (!day || !isDayStreakDay(day)) break
    streak += 1
    cursor = previousDateKey(cursor)
  }
  return streak
}

/** Seconds invested in one specific activity per dateKey, across all days. */
export function secondsByActivity(
  days: Record<string, DayState>,
  activityId: string,
): Map<string, number> {
  const byDay = new Map<string, number>()
  for (const day of Object.values(days)) {
    for (const session of day.sessions) {
      if (session.activityId === activityId && session.elapsedSeconds > 0) {
        byDay.set(day.dateKey, (byDay.get(day.dateKey) ?? 0) + session.elapsedSeconds)
      }
    }
  }
  return byDay
}

/** Consecutive days (walking back from `endDateKey`) with the activity done. */
export function computeActivityStreak(
  days: Record<string, DayState>,
  activityId: string,
  endDateKey: string,
): number {
  const byDay = secondsByActivity(days, activityId)
  let streak = 0
  let cursor = endDateKey
  if (!byDay.has(cursor)) cursor = previousDateKey(cursor) // today may not count yet
  for (let i = 0; i < 3650; i++) {
    if (!byDay.has(cursor)) break
    streak += 1
    cursor = previousDateKey(cursor)
  }
  return streak
}

/** YYYY-MM-DD minus one day. */
export function previousDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() - 1)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ---------------------------------------------------------------------------
// Formatting helpers (PT-BR)
// ---------------------------------------------------------------------------

export function formatMinutesLabel(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return 'Boa madrugada'
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export const MOTTO = 'Você não gasta tempo. Você investe tempo.'
