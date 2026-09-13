// GitHub-contribution-style habit heatmap: one small square per day,
// intensity = minutes invested in that activity. Weeks are vertical columns
// (oldest left → today right), exactly like habit trackers show evolution.

import { secondsByActivity, previousDateKey } from '../engine/timebank'
import type { DayState } from '../engine/timebank'

const WEEKS = 15
const INTENSITY_STEPS = [30 * 60, 60 * 60] // 0: none, 1: <30min, 2: <60min, 3: >=60min

const CELL_COLORS = [
  'bg-raised', // no activity
  'bg-gold/25',
  'bg-gold/55',
  'bg-gold',
]

export function HabitHeatmap({
  days,
  activityId,
  endDateKey,
}: {
  days: Record<string, DayState>
  activityId: string
  endDateKey: string // today's dateKey
}) {
  const byDay = secondsByActivity(days, activityId)

  // Grid: columns = weeks (oldest -> current), rows = weekdays (top -> bottom).
  const columns: string[][] = []
  let cursor = endDateKey
  for (let w = 0; w < WEEKS; w++) {
    const week: string[] = []
    for (let d = 0; d < 7; d++) {
      week.unshift(cursor)
      cursor = previousDateKey(cursor)
    }
    columns.unshift(week)
  }

  function levelFor(dateKey: string): number {
    const seconds = byDay.get(dateKey) ?? 0
    if (seconds <= 0) return 0
    if (seconds < INTENSITY_STEPS[0]) return 1
    if (seconds < INTENSITY_STEPS[1]) return 2
    return 3
  }

  return (
    <div className="overflow-x-auto no-scrollbar">
      <div style={{ width: 'fit-content' }}>
        {/* month labels */}
        <div className="mb-1 flex gap-[3px]">
          {columns.map((week) => {
            const monthStart = week.some((dateKey) => Number(dateKey.slice(8, 10)) <= 7)
            return (
              <span key={`label-${week[6]}`} className="w-3 text-[8px] leading-none text-muted">
                {monthStart ? monthShortLabel(week[0]) : ''}
              </span>
            )
          })}
        </div>
        {/* day cells */}
        <div className="flex gap-[3px]">
          {columns.map((week) => (
            <div key={`week-${week[6]}`} className="flex flex-col gap-[3px]">
              {week.map((dateKey) => (
                <div
                  key={dateKey}
                  title={`${formatCellDate(dateKey)}: ${Math.round((byDay.get(dateKey) ?? 0) / 60)}min`}
                  className={`h-3 w-3 shrink-0 rounded-[3px] ${CELL_COLORS[levelFor(dateKey)]} ${
                    dateKey === endDateKey ? 'ring-1 ring-gold/70' : ''
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
        {/* legend */}
        <div className="mt-1.5 flex items-center justify-end gap-1">
          <span className="mr-0.5 text-[8px] text-muted">menos</span>
          {CELL_COLORS.map((color) => (
            <div key={color} className={`h-2 w-2 rounded-[2px] ${color}`} />
          ))}
          <span className="ml-0.5 text-[8px] text-muted">mais</span>
        </div>
      </div>
    </div>
  )
}

function monthShortLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
}

function formatCellDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
