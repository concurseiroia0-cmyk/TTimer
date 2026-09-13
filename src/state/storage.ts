// localStorage persistence with a versioned schema key: "timebank:v1".

import type { AppData, DayState, UserSettings } from './types'
import { computeStartingBalance, createDayState, todayDateKey } from '../engine/timebank'

export const STORAGE_KEY = 'timebank:v1'
export const SCHEMA_VERSION = 1

export function emptyData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: null,
    onboarded: false,
    days: {},
    customTemplates: [],
    lifetimeInvestedSeconds: 0,
    completedSessions: 0,
  }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyData()
    const parsed = JSON.parse(raw) as Partial<AppData>
    if (parsed.schemaVersion !== SCHEMA_VERSION) return emptyData()
    return {
      ...emptyData(),
      ...parsed,
      schemaVersion: SCHEMA_VERSION,
      days: parsed.days ?? {},
      customTemplates: parsed.customTemplates ?? [],
      lifetimeInvestedSeconds: parsed.lifetimeInvestedSeconds ?? 0,
      completedSessions: parsed.completedSessions ?? 0,
    }
  } catch {
    return emptyData()
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full or unavailable — app keeps working in memory.
  }
}

export function ensureTodayDay(data: AppData, nowMs: number = Date.now()): { data: AppData; day: DayState } {
  if (!data.settings) return { data, day: createDayState(todayDateKey('00:00', nowMs), 0) }
  const dateKey = todayDateKey(data.settings.dayRenewsAt, nowMs)
  const existing = data.days[dateKey]
  if (existing) return { data, day: existing }
  const starting = computeStartingBalance(data.settings)
  const day = createDayState(dateKey, starting)
  return {
    data: { ...data, days: { ...data.days, [dateKey]: day } },
    day,
  }
}

export function seedDemoData(settings: UserSettings): AppData {
  const data = emptyData()
  data.settings = settings
  data.onboarded = true
  return data
}
