// Screen 4 — Extrato: bank-statement style history, weekly view and comparison.

import { useMemo, useState } from 'react'
import {
  deadTimeSeconds,
  formatMinutesLabel,
  investedSeconds,
  secondsToHHmm,
  secondsToHHMMSS,
  summarizeDay,
} from '../engine/timebank'
import type { AppData, DayState } from '../state/types'
import { previousDateKey } from '../engine/timebank'
import { Card, EmptyState, SectionTitle, StatusIcon } from '../components/ui'

export function Extrato({ data }: { data: AppData }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const sortedKeys = useMemo(
    () => Object.keys(data.days).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)),
    [data.days],
  )

  const settings = data.settings
  const todayKey = settings
    ? computeTodayKey(settings.dayRenewsAt)
    : (sortedKeys[0] ?? '')

  const activeKey = selectedKey ?? todayKey
  const day: DayState | undefined = data.days[activeKey]

  const week = useMemo(() => buildWeek(data, activeKey), [data, activeKey])
  const lastWeek = useMemo(() => buildPreviousWeek(data, activeKey), [data, activeKey])

  function go(delta: -1 | 1) {
    const next = delta === -1 ? previousDateKey(activeKey) : nextDateKey(activeKey)
    if (data.days[next] || delta === -1) setSelectedKey(next)
  }

  return (
    <div className="space-y-5">
      <section>
        <p className="text-lg font-semibold">Extrato</p>
        <p className="text-xs text-muted">Cada minuto debitado e cada investimento da sua conta de tempo.</p>
      </section>

      {/* Day selector */}
      <div className="flex items-center justify-between rounded-2xl border border-line bg-panel px-2 py-2">
        <button
          onClick={() => go(-1)}
          className="tap-target rounded-xl px-3 text-muted transition-colors hover:text-fg"
          aria-label="Dia anterior"
        >
          ←
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold">{formatDayLabel(activeKey, activeKey === todayKey)}</p>
          {day && <p className="text-[11px] text-muted">saldo inicial {secondsToHHmm(day.startingBalanceSeconds)}</p>}
        </div>
        <button
          onClick={() => go(1)}
          disabled={activeKey >= todayKey || !data.days[nextDateKey(activeKey)]}
          className="tap-target rounded-xl px-3 text-muted transition-colors hover:text-fg disabled:opacity-30"
          aria-label="Dia seguinte"
        >
          →
        </button>
      </div>

      {!day ? (
        <EmptyState
          emoji="🧾"
          title="Nenhum movimento neste dia"
          description="Quando você comprar tempo, o extrato registra cada compra, pausa e encerramento aqui."
        />
      ) : (
        <>
          <SummaryRow day={day} />

          {/* Statement */}
          <SectionTitle>Movimentos</SectionTitle>
          {day.sessions.length === 0 && day.deadTime.length === 0 ? (
            <EmptyState
              emoji="🍃"
              title="Dia sem movimentos"
              description="Nenhuma compra e nenhum tempo morto registrado. O saldo deste dia expirou inteiro."
            />
          ) : (
            <Card className="!p-0">
              <ul className="divide-y divide-line/70">
                {day.sessions.map((session) => (
                  <li key={session.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-lg" aria-hidden>
                      {session.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{session.activityName}</span>
                      <span className="flex items-center gap-1 text-xs text-muted">
                        <StatusIcon status={session.status} />
                        {session.status === 'completed'
                          ? 'concluído'
                          : session.status === 'running'
                            ? 'em andamento'
                            : session.status === 'paused'
                              ? 'pausado'
                              : 'abandonou'}
                        {session.status !== 'completed' && ` · ${secondsToHHmm(session.plannedSeconds)} planejados`}
                      </span>
                    </span>
                    <span
                      className={`font-mono text-sm font-semibold tabular-nums ${
                        session.status === 'abandoned' ? 'text-danger' : 'text-success'
                      }`}
                    >
                      −{secondsToHHMMSS(session.elapsedSeconds)}
                    </span>
                  </li>
                ))}
                {day.deadTime.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 px-4 py-3 opacity-80">
                    <span className="text-lg" aria-hidden>
                      🕳️
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{entry.label}</span>
                      <span className="text-xs text-muted">tempo morto (fora do saldo)</span>
                    </span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-muted">
                      {secondsToHHMMSS(entry.seconds)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {/* Weekly view */}
      <SectionTitle>Últimos 7 dias</SectionTitle>
      <Card>
        <WeeklyBars week={week} starting={day?.startingBalanceSeconds ?? 0} />
        <div className="mt-4 border-t border-line pt-3">
          <WeekComparison thisWeek={week.totalInvested} lastWeek={lastWeek.totalInvested} />
        </div>
      </Card>
    </div>
  )
}

function SummaryRow({ day }: { day: DayState }) {
  const summary = summarizeDay(day)
  const dead = deadTimeSeconds(day)
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-2xl border border-success/30 bg-success/5 px-3 py-3 text-center">
        <p className="text-[11px] text-muted">Investido</p>
        <p className="font-mono text-base font-bold tabular-nums text-success">{formatMinutesLabel(summary.investedSeconds)}</p>
      </div>
      <div className="rounded-2xl border border-line bg-panel px-3 py-3 text-center">
        <p className="text-[11px] text-muted">Tempo morto</p>
        <p className="font-mono text-base font-bold tabular-nums text-fg">{formatMinutesLabel(dead)}</p>
      </div>
      <div className="rounded-2xl border border-danger/30 bg-danger/5 px-3 py-3 text-center">
        <p className="text-[11px] text-muted">Desperdiçado</p>
        <p className="font-mono text-base font-bold tabular-nums text-danger">{formatMinutesLabel(summary.wastedSeconds)}</p>
      </div>
    </div>
  )
}

interface WeekDay {
  dateKey: string
  invested: number
  byActivity: Map<string, number>
  exists: boolean
}

function buildWeek(data: AppData, endDateKey: string): { days: WeekDay[]; totalInvested: number } {
  const keys: string[] = []
  let cursor = endDateKey
  for (let i = 0; i < 7; i++) {
    keys.unshift(cursor)
    cursor = previousDateKey(cursor)
  }
  const days: WeekDay[] = keys.map((key) => {
    const dayState = data.days[key]
    if (!dayState) return { dateKey: key, invested: 0, byActivity: new Map(), exists: false }
    const byActivity = new Map<string, number>()
    for (const session of dayState.sessions) {
      byActivity.set(session.activityName, (byActivity.get(session.activityName) ?? 0) + session.elapsedSeconds)
    }
    return { dateKey: key, invested: investedSeconds(dayState.sessions), byActivity, exists: true }
  })
  return { days, totalInvested: days.reduce((total, d) => total + d.invested, 0) }
}

function buildPreviousWeek(data: AppData, endDateKey: string): { totalInvested: number } {
  const weekStart = (() => {
    let cursor = endDateKey
    for (let i = 0; i < 7; i++) cursor = previousDateKey(cursor)
    return cursor
  })()
  let total = 0
  let cursor = weekStart
  for (let i = 0; i < 7; i++) {
    const dayState = data.days[cursor]
    if (dayState) total += investedSeconds(dayState.sessions)
    cursor = previousDateKey(cursor)
  }
  return { totalInvested: total }
}

function WeeklyBars({ week, starting }: { week: { days: WeekDay[] }; starting: number }) {
  const max = Math.max(starting, ...week.days.map((d) => d.invested), 60 * 60)
  return (
    <div>
      <div className="flex h-28 items-end justify-between gap-1.5">
        {week.days.map((d) => {
          const heightPct = max > 0 ? (d.invested / max) * 100 : 0
          return (
            <div key={d.dateKey} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-24 w-full items-end">
                <div
                  className={`w-full rounded-t-md ${d.exists ? 'bg-accent/80' : 'bg-raised'}`}
                  style={{ height: `${Math.max(d.invested > 0 ? 4 : 2, heightPct)}%` }}
                  title={`${formatDayLabel(d.dateKey, false)}: ${formatMinutesLabel(d.invested)} investidos`}
                />
              </div>
              <span className="text-[10px] text-muted">{weekdayLetter(d.dateKey)}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>Investido por dia</span>
        <span className="font-mono tabular-nums">total {formatMinutesLabel(week.days.reduce((t, d) => t + d.invested, 0))}</span>
      </div>
    </div>
  )
}

function WeekComparison({ thisWeek, lastWeek }: { thisWeek: number; lastWeek: number }) {
  const diff = thisWeek - lastWeek
  if (lastWeek === 0 && thisWeek === 0) {
    return <p className="text-center text-xs text-muted">Sem dados suficientes para comparar semanas ainda.</p>
  }
  const pct = lastWeek > 0 ? Math.round((diff / lastWeek) * 100) : null
  const label =
    diff === 0
      ? 'Você investiu o mesmo que na semana passada.'
      : diff > 0
        ? `Você investiu ${formatMinutesLabel(diff)} a mais que na semana passada${pct != null ? ` (+${pct}%)` : ''}.`
        : `Você investiu ${formatMinutesLabel(Math.abs(diff))} a menos que na semana passada${pct != null ? ` (−${pct}%)` : ''}.`
  return (
    <p className={`text-center text-xs ${diff >= 0 ? 'text-success' : 'text-danger'}`}>{label}</p>
  )
}

export function formatDayLabel(dateKey: string, isToday: boolean): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const label = date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
  return isToday ? `Hoje · ${label}` : label
}

function weekdayLetter(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3).replace('.', '')
}

function computeTodayKey(dayRenewsAt: string): string {
  const now = new Date()
  const [h, m] = dayRenewsAt.split(':').map(Number)
  const renewMinutes = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
  const shifted = new Date(now)
  if (now.getHours() * 60 + now.getMinutes() < renewMinutes) shifted.setDate(shifted.getDate() - 1)
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`
}

function nextDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

