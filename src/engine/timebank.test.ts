import { describe, expect, it } from 'vitest'
import {
  applyTick,
  catchUpAfterBackground,
  computeActivityStreak,
  computeDateKey,
  computeRemaining,
  computeSleepDuration,
  computeStartingBalance,
  createDayState,
  createSession,
  effectiveBalanceSeconds,
  evolutionCoins,
  previousDateKey,
  secondsByActivity,
  secondsToHHmm,
  secondsToHHMMSS,
  summarizeDay,
  validateSettings,
} from './timebank'
import type { DayState, Session } from './timebank'

// Fixed wall clock: a local Thursday, 10:00:00.
const BASE = new Date(2026, 8, 10, 10, 0, 0, 0).getTime() // 2026-09-10 10:00 local

const DEFAULT_SETTINGS = {
  name: 'Ana',
  sleepStart: '22:00',
  wakeTime: '06:00',
  workHoursPerDay: 8,
  mealsHygieneHours: 2,
  dayRenewsAt: '06:00',
}

describe('computeSleepDuration', () => {
  it('crosses midnight', () => {
    expect(computeSleepDuration('22:00', '06:00')).toBe(8 * 3600)
  })
  it('handles same-day short sleep', () => {
    expect(computeSleepDuration('06:00', '07:30')).toBe(1.5 * 3600)
  })
  it('returns 0 for invalid input', () => {
    expect(computeSleepDuration('25:00', '06:00')).toBe(0)
    expect(computeSleepDuration('', '06:00')).toBe(0)
  })
  it('treats zero-length window as a full day', () => {
    // 06:00 -> 06:00 must not be 0 (would zero out sleep and inflate balance).
    expect(computeSleepDuration('06:00', '06:00')).toBe(24 * 3600)
  })
})

describe('computeDateKey', () => {
  it('keeps late night before renew hour on the previous day', () => {
    // 2026-09-11 05:59 with renew 06:00 belongs to 2026-09-10.
    const at559 = new Date(2026, 8, 11, 5, 59).getTime()
    expect(computeDateKey(at559, '06:00')).toBe('2026-09-10')
  })
  it('rolls over exactly at renew hour', () => {
    const at600 = new Date(2026, 8, 11, 6, 0).getTime()
    expect(computeDateKey(at600, '06:00')).toBe('2026-09-11')
  })
  it('defaults to midnight renew when unparseable', () => {
    const at2359 = new Date(2026, 8, 11, 23, 59).getTime()
    expect(computeDateKey(at2359, 'zzz')).toBe('2026-09-11')
  })
})

describe('computeStartingBalance', () => {
  it('applies the core formula 24h - sleep - work - meals', () => {
    // 24 - 8 - 8 - 2 = 6h
    expect(computeStartingBalance(DEFAULT_SETTINGS)).toBe(6 * 3600)
  })
  it('returns 0 when settings are invalid', () => {
    expect(computeStartingBalance({ ...DEFAULT_SETTINGS, workHoursPerDay: 20 })).toBe(0)
  })
})

describe('effectiveBalanceSeconds (clock-melted balance)', () => {
  const STARTING = 6 * 3600
  const sessions: Session[] = []

  it('caps the balance at the wall-clock time left before renewal', () => {
    // Ledger still has 6h but only 3h left until the day expires.
    expect(effectiveBalanceSeconds(STARTING, sessions, 3 * 3600)).toBe(3 * 3600)
  })
  it('uses the ledger when it is smaller than the time left', () => {
    // Spent 4h of sessions → 2h left on the ledger, 5h on the clock.
    const spent: Session[] = [{
      id: 's1', dateKey: '2026-09-10', activityId: 'read', activityName: 'Leitura',
      emoji: '📖', plannedSeconds: 4 * 3600, elapsedSeconds: 4 * 3600, status: 'completed',
      startedAt: '2026-09-10T10:00:00Z',
    }]
    expect(effectiveBalanceSeconds(STARTING, spent, 5 * 3600)).toBe(2 * 3600)
  })
  it('is 0 when the day has expired', () => {
    expect(effectiveBalanceSeconds(STARTING, sessions, 0)).toBe(0)
  })
  it('never goes negative', () => {
    expect(effectiveBalanceSeconds(STARTING, sessions, -60)).toBe(0)
  })
})

describe('validateSettings', () => {
  it('blocks zero sleep duration', () => {
    const result = validateSettings({ ...DEFAULT_SETTINGS, sleepStart: '06:00', wakeTime: '06:00' })
    // 06:00->06:00 is treated as 24h sleep, so busy >= 24h → blocked.
    expect(result.ok).toBe(false)
  })
  it('blocks busy time >= 24h', () => {
    const result = validateSettings({ ...DEFAULT_SETTINGS, workHoursPerDay: 20 })
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
  it('accepts a sane day', () => {
    expect(validateSettings(DEFAULT_SETTINGS).ok).toBe(true)
  })
})

describe('applyTick', () => {
  const STARTING = 6 * 3600

  function freshDay(overrides: Partial<DayState> = {}): DayState {
    return { ...createDayState('2026-09-10', STARTING), ...overrides }
  }

  function runningSession(overrides: Partial<Session> = {}): Session {
    return {
      ...createSession({
        id: 's1',
        dateKey: '2026-09-10',
        activityId: 'read',
        activityName: 'Leitura',
        emoji: '📖',
        plannedSeconds: 1800,
        nowMs: BASE,
      }),
      ...overrides,
    }
  }

  it('charges one second per wall-clock second (no drift)', () => {
    let day = freshDay({ sessions: [runningSession()], lastTickAt: new Date(BASE).toISOString() })
    for (let i = 1; i <= 10; i++) {
      day = applyTick(day, BASE + i * 1000).day
    }
    expect(day.sessions[0].elapsedSeconds).toBe(10)
    expect(day.remainingBalanceSeconds).toBe(STARTING - 10)
  })

  it('catches up a large background gap using timestamps', () => {
    const day = freshDay({
      sessions: [runningSession()],
      lastTickAt: new Date(BASE).toISOString(),
    })
    const result = applyTick(day, BASE + 90 * 1000)
    expect(result.day.sessions[0].elapsedSeconds).toBe(90)
    expect(result.day.remainingBalanceSeconds).toBe(STARTING - 90)
    expect(result.stopped).toBe(false)
  })

  it('never exceeds plannedSeconds', () => {
    const day = freshDay({
      sessions: [runningSession({ elapsedSeconds: 1790 })],
      lastTickAt: new Date(BASE).toISOString(),
    })
    const result = applyTick(day, BASE + 60 * 1000)
    expect(result.day.sessions[0].elapsedSeconds).toBe(1800)
    expect(result.day.sessions[0].status).toBe('completed')
    expect(result.stopped).toBe(true)
    expect(result.stopReason).toBe('session-complete')
  })

  it('charges up to the balance edge without going negative, then exhausts', () => {
    const day = freshDay({
      startingBalanceSeconds: 100,
      remainingBalanceSeconds: 100,
      sessions: [runningSession({ plannedSeconds: 1800 })],
      lastTickAt: new Date(BASE).toISOString(),
    })
    // 90s tick against 100s balance: session keeps running.
    const first = applyTick(day, BASE + 90 * 1000)
    expect(first.day.remainingBalanceSeconds).toBe(10)
    expect(first.day.sessions[0].elapsedSeconds).toBe(90)
    expect(first.stopped).toBe(false)

    // A 10s+ tick exhausts the balance and auto-stops the session.
    const second = applyTick(first.day, BASE + 100 * 1000)
    expect(second.day.remainingBalanceSeconds).toBe(0)
    expect(second.day.sessions[0].elapsedSeconds).toBe(100)
    expect(second.day.sessions[0].status).toBe('abandoned')
    expect(second.stopReason).toBe('balance-exhausted')
  })

  it('does nothing without a running session', () => {
    const day = freshDay()
    const result = applyTick(day, BASE + 5000)
    expect(result.day.sessions).toHaveLength(0)
  })

  it('pausing freezes the drain', () => {
    const day = freshDay({
      sessions: [runningSession({ status: 'paused', elapsedSeconds: 300 })],
      lastTickAt: new Date(BASE).toISOString(),
    })
    const result = applyTick(day, BASE + 60 * 1000)
    expect(result.day.sessions[0].elapsedSeconds).toBe(300)
  })

  it('does not tick into the next day (renewal guard)', () => {
    const day = freshDay({ sessions: [runningSession()] })
    const nextDay = applyTick(day, BASE + 25 * 3600 * 1000)
    expect(nextDay.stopped).toBe(false)
    expect(nextDay.day.sessions[0].elapsedSeconds).toBe(0)
  })
})

describe('catchUpAfterBackground', () => {
  const STARTING = 6 * 3600

  it('charges closed-app time capped by plan and balance, then continues', () => {
    let day = createDayState('2026-09-10', STARTING)
    const session = createSession({
      id: 's1',
      dateKey: '2026-09-10',
      activityId: 'read',
      activityName: 'Leitura',
      emoji: '📖',
      plannedSeconds: 1800,
      nowMs: BASE,
    })
    day = { ...day, sessions: [session], lastTickAt: new Date(BASE).toISOString() }
    const result = catchUpAfterBackground(day, BASE + 700 * 1000)
    expect(result.day.sessions[0].elapsedSeconds).toBe(700)
    expect(result.day.sessions[0].status).toBe('running')
  })

  it('completes when catch-up exceeds the plan', () => {
    let day = createDayState('2026-09-10', STARTING)
    const session = createSession({
      id: 's1',
      dateKey: '2026-09-10',
      activityId: 'read',
      activityName: 'Leitura',
      emoji: '📖',
      plannedSeconds: 600,
      nowMs: BASE,
    })
    day = { ...day, sessions: [session], lastTickAt: new Date(BASE).toISOString() }
    const result = catchUpAfterBackground(day, BASE + 15 * 60 * 1000)
    expect(result.day.sessions[0].status).toBe('completed')
    expect(result.stopReason).toBe('session-complete')
  })
})

describe('summaries', () => {
  it('computes invested, wasted and ratio', () => {
    const day = createDayState('2026-09-10', 6 * 3600)
    const session = {
      ...createSession({
        id: 's1',
        dateKey: '2026-09-10',
        activityId: 'read',
        activityName: 'Leitura',
        emoji: '📖',
        plannedSeconds: 3600,
        nowMs: BASE,
      }),
      status: 'completed' as const,
      elapsedSeconds: 3600,
    }
    const summary = summarizeDay({ ...day, sessions: [session] })
    expect(summary.investedSeconds).toBe(3600)
    expect(summary.wastedSeconds).toBe(5 * 3600)
    expect(summary.investedRatio).toBeCloseTo(1 / 6)
  })
})

describe('gamification + format', () => {
  it('floors coins per full hour', () => {
    expect(evolutionCoins(0)).toBe(0)
    expect(evolutionCoins(3599)).toBe(0)
    expect(evolutionCoins(3 * 3600 + 59 * 60)).toBe(3)
  })

  it('formats HH:MM and HH:MM:SS', () => {
    expect(secondsToHHmm(3661)).toBe('01:01')
    expect(secondsToHHMMSS(3661)).toBe('01:01:01')
    expect(secondsToHHMMSS(-5)).toBe('00:00:00')
  })

  it('never computes negative remaining', () => {
    const session = {
      ...createSession({
        id: 's1',
        dateKey: '2026-09-10',
        activityId: 'read',
        activityName: 'Leitura',
        emoji: '📖',
        plannedSeconds: 500,
        nowMs: BASE,
      }),
      status: 'completed' as const,
      elapsedSeconds: 400,
    }
    expect(computeRemaining(100, [session])).toBe(0)
  })

  it('aggregates activity seconds per day', () => {
    const days: Record<string, DayState> = {
      '2026-09-09': {
        ...createDayState('2026-09-09', 6 * 3600),
        sessions: [
          { ...makeSession('a1', '2026-09-09', 600, 'completed') },
          { ...makeSession('a1', '2026-09-09', 300, 'abandoned') },
        ],
      },
      '2026-09-10': {
        ...createDayState('2026-09-10', 6 * 3600),
        sessions: [{ ...makeSession('a1', '2026-09-10', 1200, 'completed') }],
      },
    }
    const byDay = secondsByActivity(days, 'a1')
    expect(byDay.get('2026-09-09')).toBe(900)
    expect(byDay.get('2026-09-10')).toBe(1200)
  })

  it('computes per-activity streaks back from today or yesterday', () => {
    const makeDay = (key: string, seconds: number): DayState => ({
      ...createDayState(key, 6 * 3600),
      sessions: seconds > 0 ? [{ ...makeSession('a1', key, seconds, 'completed') }] : [],
    })
    const days: Record<string, DayState> = {
      '2026-09-08': makeDay('2026-09-08', 600),
      '2026-09-09': makeDay('2026-09-09', 600),
      '2026-09-10': makeDay('2026-09-10', 0), // today: not done yet
    }
    // Today has no activity yet → streak counts from yesterday backwards.
    expect(computeActivityStreak(days, 'a1', '2026-09-10')).toBe(2)
    // With today done, the streak extends.
    days['2026-09-10'] = makeDay('2026-09-10', 300)
    expect(computeActivityStreak(days, 'a1', '2026-09-10')).toBe(3)
    // A gap breaks the streak.
    days['2026-09-09'] = makeDay('2026-09-09', 0)
    expect(computeActivityStreak(days, 'a1', '2026-09-10')).toBe(1)
    expect(previousDateKey('2026-09-10')).toBe('2026-09-09')
  })
})

function makeSession(
  activityId: string,
  dateKey: string,
  elapsedSeconds: number,
  status: 'completed' | 'abandoned',
): Session {
  return {
    ...createSession({
      id: `s_${activityId}_${dateKey}_${elapsedSeconds}`,
      dateKey,
      activityId,
      activityName: 'Atividade',
      emoji: '🎯',
      plannedSeconds: Math.max(elapsedSeconds, 60),
      nowMs: BASE,
    }),
    status,
    elapsedSeconds,
  }
}
