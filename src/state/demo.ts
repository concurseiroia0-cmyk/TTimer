// Demo seed — ONLY used when URL contains ?demo=1 (per spec, never otherwise).

import type { AppData, DayState, Session } from './types'
import { computeStartingBalance, createDayState, todayDateKey } from '../engine/timebank'
import { emptyData } from './storage'

const DEFAULT_DEMO_SETTINGS = {
  name: 'Ana',
  sleepStart: '22:00',
  wakeTime: '06:00',
  workHoursPerDay: 8,
  mealsHygieneHours: 2,
  dayRenewsAt: '00:00',
  weeklyGoals: [
    { activityId: 'read', minutes: 210 },
    { activityId: 'exercise', minutes: 135 },
  ],
}

function session(partial: Omit<Session, 'status'> & { status?: Session['status'] }): Session {
  return { status: 'completed', ...partial }
}

export function buildDemoData(nowMs: number = Date.now()): AppData {
  const data = emptyData()
  const settings = { ...DEFAULT_DEMO_SETTINGS }
  data.settings = settings
  data.onboarded = true

  const starting = computeStartingBalance(settings) // 6h
  const todayKey = todayDateKey(settings.dayRenewsAt, nowMs)

  const days: Record<string, DayState> = {}

  // Yesterday: a strong day.
  const yesterdayKey = previousKey(todayKey)
  const yesterday = createDayState(yesterdayKey, starting)
  const readSession = session({
    id: 'demo_y_read',
    dateKey: yesterdayKey,
    activityId: 'read',
    activityName: 'Leitura',
    emoji: '📖',
    plannedSeconds: 45 * 60,
    elapsedSeconds: 45 * 60,
    startedAt: new Date(nowMs - 26 * 3600 * 1000).toISOString(),
    endedAt: new Date(nowMs - 25 * 3600 * 1000).toISOString(),
  })
  const exerciseSession = session({
    id: 'demo_y_ex',
    dateKey: yesterdayKey,
    activityId: 'exercise',
    activityName: 'Exercício',
    emoji: '🏋️',
    plannedSeconds: 40 * 60,
    elapsedSeconds: 40 * 60,
    startedAt: new Date(nowMs - 24 * 3600 * 1000).toISOString(),
    endedAt: new Date(nowMs - 23 * 3600 * 1000).toISOString(),
  })
  const abandonedStudy = session({
    id: 'demo_y_st',
    dateKey: yesterdayKey,
    activityId: 'study',
    activityName: 'Estudo / Curso',
    emoji: '📚',
    plannedSeconds: 60 * 60,
    elapsedSeconds: 17 * 60,
    status: 'abandoned',
    startedAt: new Date(nowMs - 23 * 3600 * 1000).toISOString(),
    endedAt: new Date(nowMs - 22 * 3600 * 1000).toISOString(),
  })
  yesterday.sessions = [readSession, exerciseSession, abandonedStudy]
  yesterday.deadTime = [
    { id: 'demo_y_dt1', dateKey: yesterdayKey, label: 'Redes sociais', seconds: 55 * 60 },
    { id: 'demo_y_dt2', dateKey: yesterdayKey, label: 'Séries', seconds: 40 * 60 },
  ]
  yesterday.remainingBalanceSeconds = starting - (45 + 40 + 17) * 60
  yesterday.nightReflection = 'Melhor dia da semana. Leitura antes de dormir funcionou de novo.'
  days[yesterdayKey] = yesterday

  // Day before yesterday: a weak day (almost everything wasted).
  const twoDaysAgo = previousKey(yesterdayKey)
  const weakDay = createDayState(twoDaysAgo, starting)
  weakDay.sessions = [
    session({
      id: 'demo_w_med',
      dateKey: twoDaysAgo,
      activityId: 'meditate',
      activityName: 'Meditação',
      emoji: '🧘',
      plannedSeconds: 15 * 60,
      elapsedSeconds: 15 * 60,
      startedAt: new Date(nowMs - 50 * 3600 * 1000).toISOString(),
      endedAt: new Date(nowMs - 50 * 3600 * 1000 + 15 * 60 * 1000).toISOString(),
    }),
  ]
  weakDay.deadTime = [{ id: 'demo_w_dt1', dateKey: twoDaysAgo, label: 'Jogos', seconds: 95 * 60 }]
  weakDay.remainingBalanceSeconds = starting - 15 * 60
  days[twoDaysAgo] = weakDay

  // Today: one completed purchase so far.
  const today = createDayState(todayKey, starting)
  const todaySession = session({
    id: 'demo_t_read',
    dateKey: todayKey,
    activityId: 'read',
    activityName: 'Leitura',
    emoji: '📖',
    plannedSeconds: 25 * 60,
    elapsedSeconds: 25 * 60,
    startedAt: new Date(nowMs - 4 * 3600 * 1000).toISOString(),
    endedAt: new Date(nowMs - 4 * 3600 * 1000 + 25 * 60 * 1000).toISOString(),
  })
  today.sessions = [todaySession]
  today.remainingBalanceSeconds = starting - 25 * 60
  days[todayKey] = today

  data.days = days
  data.lifetimeInvestedSeconds = (45 + 40 + 17 + 15 + 25) * 60
  data.completedSessions = 4
  return data
}

function previousKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() - 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
