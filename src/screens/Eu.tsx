// Screen 5 — Eu: profile, settings, streaks, coins, badges, goals, dead time.

import { useMemo, useState } from 'react'
import {
  computeActivityStreak,
  computeStreak,
  deadTimeSeconds,
  evolutionCoins,
  formatMinutesLabel,
  investedSeconds,
  previousDateKey,
  secondsToHHmm,
  sleepDurationLabel,
  validateSettings,
} from '../engine/timebank'
import { HabitHeatmap } from '../components/HabitHeatmap'
import type { AppData, DeadTimeLabel, DayState, UserSettings } from '../state/types'
import type { ActivityTemplate } from '../state/types'
import { addDeadTime, resetAllData, setNightReflection, updateSettings } from '../state/store'
import { Button, Card, Motto, SectionTitle, TimeField } from '../components/ui'

const DEAD_TIME_LABELS: DeadTimeLabel[] = ['Redes sociais', 'Jogos', 'Séries', 'Outro']
const DEAD_TIME_ADDS = [10, 15, 30, 60]

interface Badge {
  id: string
  emoji: string
  name: string
  description: string
  achieved: boolean
}

export function Eu({
  data,
  day,
  templates,
  todayKey,
}: {
  data: AppData
  day: DayState
  templates: ActivityTemplate[]
  todayKey: string
}) {
  const settings = data.settings!
  const [deadLabel, setDeadLabel] = useState<DeadTimeLabel | null>(null)
  const [shockShown, setShockShown] = useState(false)

  const lifetimeByActivity = useMemo(() => {
    const totals = new Map<string, { name: string; seconds: number; days: Set<string> }>()
    for (const dayState of Object.values(data.days)) {
      for (const session of dayState.sessions) {
        const entry = totals.get(session.activityId) ?? { name: session.activityName, seconds: 0, days: new Set() }
        entry.seconds += session.elapsedSeconds
        if (session.elapsedSeconds > 0) entry.days.add(dayState.dateKey)
        totals.set(session.activityId, entry)
      }
    }
    return totals
  }, [data.days])

  const todayQualifies = day.startingBalanceSeconds > 0 && investedSeconds(day.sessions) >= day.startingBalanceSeconds * 0.3
  const currentStreak = computeStreak(Object.values(data.days), todayKey)
  const displayStreak = todayQualifies ? currentStreak : computeStreak(Object.values(data.days), previousDateKey(todayKey))
  const coins = evolutionCoins(data.lifetimeInvestedSeconds)

  const badges: Badge[] = [
    {
      id: 'first',
      emoji: '🌱',
      name: 'Primeiro depósito',
      description: 'Concluiu a primeira sessão completa',
      achieved: data.completedSessions >= 1,
    },
    { id: 'h10', emoji: '🥉', name: '10 horas', description: '10h investidas na vida', achieved: data.lifetimeInvestedSeconds >= 10 * 3600 },
    { id: 'h50', emoji: '🥈', name: '50 horas', description: '50h investidas na vida', achieved: data.lifetimeInvestedSeconds >= 50 * 3600 },
    { id: 'h100', emoji: '🥇', name: '100 horas', description: '100h investidas na vida', achieved: data.lifetimeInvestedSeconds >= 100 * 3600 },
    {
      id: 'streak7',
      emoji: '🔥',
      name: 'Sequência de 7',
      description: '7 dias seguidos investindo ≥30%',
      achieved: displayStreak >= 7,
    },
    {
      id: 'streak30',
      emoji: '💎',
      name: 'Sequência de 30',
      description: '30 dias seguidos investindo ≥30%',
      achieved: displayStreak >= 30,
    },
  ]

  const deadToday = deadTimeSeconds(day)
  const investedToday = investedSeconds(day.sessions)
  const showShock = shockShown && deadToday >= investedToday && deadToday > 0

  function handleAddDeadTime(label: DeadTimeLabel, minutes: number) {
    addDeadTime(label, minutes * 60)
    setShockShown(true)
  }

  return (
    <div className="space-y-5">
      {/* Profile */}
      <Card className="bg-panel-2">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-2xl"
            aria-hidden
          >
            🏦
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{settings.name}</p>
            <p className="truncate text-xs text-muted">saldo diário {secondsToHHmm(day.startingBalanceSeconds)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-xl font-bold tabular-nums text-accent">🪙 {coins}</p>
            <p className="text-[10px] text-muted">moedas de evolução</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-raised px-3 py-2">
            <p className="font-mono text-lg font-bold tabular-nums text-fg">{displayStreak}</p>
            <p className="text-[11px] text-muted">dias de sequência (≥30%)</p>
          </div>
          <div className="rounded-xl bg-raised px-3 py-2">
            <p className="font-mono text-lg font-bold tabular-nums text-fg">{formatMinutesLabel(data.lifetimeInvestedSeconds)}</p>
            <p className="text-[11px] text-muted">investidos na vida</p>
          </div>
        </div>
      </Card>

      {/* Evolution per activity: heatmap + streak */}
      {lifetimeByActivity.size > 0 && (
        <>
          <SectionTitle>Sua evolução</SectionTitle>
          <div className="space-y-2">
            {[...lifetimeByActivity.entries()]
              .sort((a, b) => b[1].seconds - a[1].seconds)
              .slice(0, 5)
              .map(([id, entry]) => {
                const streak = computeActivityStreak(data.days, id, todayKey)
                const template = templates.find((t) => t.id === id)
                return (
                  <Card key={id}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold">
                        {template?.emoji ?? '🎯'} {entry.name}
                      </p>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                        <span className="font-mono tabular-nums">{formatMinutesLabel(entry.seconds)} na vida</span>
                        {streak > 0 ? (
                          <span className="font-semibold text-success">🔥 {streak}d</span>
                        ) : (
                          <span>—</span>
                        )}
                      </span>
                    </div>
                    <HabitHeatmap days={data.days} activityId={id} endDateKey={todayKey} />
                  </Card>
                )
              })}
          </div>
        </>
      )}

      {/* Badges */}
      <SectionTitle>Conquistas</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {badges.map((badge) => (
          <div
            key={badge.id}
            title={badge.description}
            className={`rounded-2xl border p-3 text-center ${
              badge.achieved ? 'bg-accent/15' : 'bg-panel opacity-40'
            }`}
          >
            <p className={`text-2xl ${badge.achieved ? '' : 'grayscale'}`} aria-hidden>
              {badge.emoji}
            </p>
            <p className="mt-1 text-[11px] leading-tight font-semibold">{badge.name}</p>
          </div>
        ))}
      </div>

      {/* Weekly goals */}
      <SectionTitle>Metas semanais</SectionTitle>
      <WeeklyGoalsCard data={data} templates={templates} todayKey={todayKey} />

      {/* Dead time logger */}
      <SectionTitle>Registrar tempo morto</SectionTitle>
      <Card>
        <p className="text-xs text-muted">
          Tempo fora do saldo que sumiu sem investimento. Registrar é contabilidade, não punição.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEAD_TIME_LABELS.map((label) => (
            <button
              key={label}
              onClick={() => setDeadLabel(deadLabel === label ? null : label)}
              className={`tap-target rounded-xl border px-3 text-sm transition-colors ${
                deadLabel === label ? 'bg-danger/15 text-danger' : 'bg-raised/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {deadLabel && (
          <div className="mt-3 flex flex-wrap gap-2">
            {DEAD_TIME_ADDS.map((minutes) => (
              <button
                key={minutes}
                onClick={() => handleAddDeadTime(deadLabel, minutes)}
                className="tap-target rounded-xl bg-danger/15 px-3 text-sm font-medium text-danger tabular-nums"
              >
                +{minutes}min
              </button>
            ))}
          </div>
        )}
        {deadToday > 0 && (
          <p className="mt-3 text-xs text-muted">
            Hoje: <span className="font-mono font-semibold text-danger tabular-nums">{formatMinutesLabel(deadToday)}</span> de tempo
            morto registrado.
          </p>
        )}
        {showShock && (
          <p className="mt-2 rounded-xl bg-danger/15 px-3 py-2 text-sm text-danger">
            Você registrou mais tempo morto do que tempo investido hoje. Isso é um empréstimo que seu futuro paga.
          </p>
        )}
      </Card>

      {/* Night reflection */}
      <SectionTitle>Reflexão da noite</SectionTitle>
      <NightReflectionCard day={day} />

      {/* Settings */}
      <SectionTitle>Configurações</SectionTitle>
      <SettingsCard settings={settings} />

      {/* Danger zone */}
      <SectionTitle>Zona de risco</SectionTitle>
      <DangerZone />

      <Motto className="pt-2" />
    </div>
  )
}

// ---------------------------------------------------------------------------

function WeeklyGoalsCard({
  data,
  templates,
  todayKey,
}: {
  data: AppData
  templates: ActivityTemplate[]
  todayKey: string
}) {
  const settings = data.settings!
  const goals = settings.weeklyGoals ?? []

  const investedThisWeekByActivity = useMemo(() => {
    const totals = new Map<string, number>()
    let cursor = todayKey
    for (let i = 0; i < 7; i++) {
      const day = data.days[cursor]
      if (day) {
        for (const session of day.sessions) {
          totals.set(session.activityId, (totals.get(session.activityId) ?? 0) + session.elapsedSeconds)
        }
      }
      cursor = previousDateKey(cursor)
    }
    return totals
  }, [data.days, todayKey])

  const [newActivityId, setNewActivityId] = useState(templates[0]?.id ?? '')
  const [newMinutes, setNewMinutes] = useState('30')

  function addGoal() {
    const minutes = Number(newMinutes)
    if (!newActivityId || !Number.isFinite(minutes) || minutes <= 0) return
    const next = [...goals.filter((g) => g.activityId !== newActivityId), { activityId: newActivityId, minutes }]
    updateSettings({ ...settings, weeklyGoals: next })
  }

  function removeGoal(activityId: string) {
    updateSettings({ ...settings, weeklyGoals: goals.filter((g) => g.activityId !== activityId) })
  }

  return (
    <Card>
      {goals.length === 0 && <p className="text-sm text-muted">Defina uma meta semanal para uma atividade.</p>}
      <div className="space-y-3">
        {goals.map((goal) => {
          const template = templates.find((t) => t.id === goal.activityId)
          const done = investedThisWeekByActivity.get(goal.activityId) ?? 0
          const pct = Math.min(100, Math.round((done / (goal.minutes * 60)) * 100))
          return (
            <div key={goal.activityId}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {template?.emoji ?? '🎯'} {template?.name ?? goal.activityId}
                </span>
                <span className="flex items-center gap-2 text-muted">
                  <span className="font-mono tabular-nums">
                    {formatMinutesLabel(done)} / {goal.minutes}min
                  </span>
                  <button
                    onClick={() => removeGoal(goal.activityId)}
                    className="tap-target rounded-lg px-1.5 text-danger"
                    aria-label="Remover meta"
                  >
                    ✕
                  </button>
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-raised">
                <div
                  className={`h-full rounded-full ${pct >= 100 ? 'bg-success' : 'bg-accent'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs text-muted">Atividade</span>
          <select
            value={newActivityId}
            onChange={(event) => setNewActivityId(event.target.value)}
            className="tap-target w-full rounded-xl bg-raised px-3 text-sm outline-none focus:border-accent/60"
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.emoji} {template.name}
              </option>
            ))}
          </select>
        </label>
        <label className="w-24">
          <span className="mb-1 block text-xs text-muted">min/sem</span>
          <input
            type="number"
            min={10}
            step={10}
            value={newMinutes}
            onChange={(event) => setNewMinutes(event.target.value)}
            className="tap-target w-full rounded-xl bg-raised px-3 text-sm tabular-nums outline-none focus:border-accent/60"
          />
        </label>
        <Button variant="ghost" onClick={addGoal}>
          Add
        </Button>
      </div>
    </Card>
  )
}

function NightReflectionCard({ day }: { day: DayState }) {
  const [text, setText] = useState(day.nightReflection ?? '')
  const [saved, setSaved] = useState(false)
  return (
    <Card>
      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setSaved(false)
        }}
        rows={3}
        maxLength={500}
        placeholder="O que o seu saldo de hoje diz sobre as suas prioridades?"
        className="w-full resize-none rounded-xl bg-raised px-3 py-2 text-sm outline-none placeholder:text-muted/60 focus:border-accent/60"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-muted">{text.length}/500 · salvo neste dia</span>
        <Button
          variant="success"
          onClick={() => {
            setNightReflection(day.dateKey, text.trim())
            setSaved(true)
          }}
        >
          {saved ? 'Salvo ✓' : 'Salvar'}
        </Button>
      </div>
    </Card>
  )
}

function SettingsCard({ settings }: { settings: UserSettings }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(settings.name)
  const [sleepStart, setSleepStart] = useState(settings.sleepStart)
  const [wakeTime, setWakeTime] = useState(settings.wakeTime)
  const [workHours, setWorkHours] = useState(String(settings.workHoursPerDay))
  const [mealsHours, setMealsHours] = useState(String(settings.mealsHygieneHours))
  const [dayRenewsAt, setDayRenewsAt] = useState(settings.dayRenewsAt)

  const draft: UserSettings = {
    name: name.trim() || settings.name,
    sleepStart,
    wakeTime,
    workHoursPerDay: Number(workHours) || 0,
    mealsHygieneHours: Number(mealsHours) || 0,
    dayRenewsAt,
    weeklyGoals: settings.weeklyGoals,
  }
  const validation = validateSettings(draft)

  if (!editing) {
    return (
      <Card>
        <div className="space-y-2 text-sm">
          <Row label="Nome" value={settings.name} />
          <Row label="Sono" value={`${settings.sleepStart} → ${settings.wakeTime} (${sleepDurationLabel(settings.sleepStart, settings.wakeTime)})`} />
          <Row label="Trabalho" value={`${settings.workHoursPerDay}h / dia`} />
          <Row label="Refeições e higiene" value={`${settings.mealsHygieneHours}h / dia`} />
          <Row label="Dia renova às" value={settings.dayRenewsAt} />
          <Row label="Saldo diário" value={secondsToHHmm(computeBalance(settings))} accent />
        </div>
        <Button variant="ghost" block className="mt-4" onClick={() => setEditing(true)}>
          Editar
        </Button>
      </Card>
    )
  }

  return (
    <Card>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block px-1 text-sm font-medium text-muted">Nome</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            className="tap-target w-full rounded-xl bg-raised px-4 text-base outline-none focus:border-accent/60"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <TimeField label="Dorme às" value={sleepStart} onChange={setSleepStart} />
          <TimeField label="Acorda às" value={wakeTime} onChange={setWakeTime} />
        </div>
        <label className="block">
          <span className="mb-1.5 block px-1 text-sm font-medium text-muted">Trabalho / obrigações (h/dia)</span>
          <input
            type="number"
            min={0}
            max={16}
            step={0.5}
            value={workHours}
            onChange={(event) => setWorkHours(event.target.value)}
            className="tap-target w-full rounded-xl bg-raised px-4 text-base tabular-nums outline-none focus:border-accent/60"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block px-1 text-sm font-medium text-muted">Refeições e higiene (h/dia)</span>
          <input
            type="number"
            min={0}
            max={8}
            step={0.5}
            value={mealsHours}
            onChange={(event) => setMealsHours(event.target.value)}
            className="tap-target w-full rounded-xl bg-raised px-4 text-base tabular-nums outline-none focus:border-accent/60"
          />
        </label>
        <TimeField label="O dia renova às" value={dayRenewsAt} onChange={setDayRenewsAt} hint="05:59 ainda pertence a hoje." />
      </div>

      {!validation.ok && (
        <ul className="mt-3 space-y-1 text-sm text-danger">
          {validation.errors.map((error) => (
            <li key={error}>• {error}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted">
        Mudanças valem a partir de agora. Dias passados não são reescritos.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            setName(settings.name)
            setSleepStart(settings.sleepStart)
            setWakeTime(settings.wakeTime)
            setWorkHours(String(settings.workHoursPerDay))
            setMealsHours(String(settings.mealsHygieneHours))
            setDayRenewsAt(settings.dayRenewsAt)
            setEditing(false)
          }}
        >
          Cancelar
        </Button>
        <Button
          variant="accent"
          disabled={!validation.ok}
          onClick={() => {
            updateSettings(draft)
            setEditing(false)
          }}
        >
          Salvar
        </Button>
      </div>
    </Card>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className={`text-right ${accent ? 'font-mono font-bold text-accent tabular-nums' : 'font-medium'}`}>{value}</span>
    </div>
  )
}

function computeBalance(settings: UserSettings): number {
  const validation = validateSettings(settings)
  return validation.ok ? 24 * 3600 - validation.busySeconds : 0
}

function DangerZone() {
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <Card>
        <p className="text-xs text-muted">Apaga onboarding, dias, compras e conquistas deste dispositivo.</p>
        <Button variant="danger" block className="mt-3" onClick={() => setConfirming(true)}>
          Apagar todos os dados
        </Button>
      </Card>
    )
  }
  return (
    <Card className="bg-danger/10">
      <p className="text-sm text-danger">Tem certeza? Não dá para desfazer.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => setConfirming(false)}>
          Manter meus dados
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            resetAllData()
            window.location.reload()
          }}
        >
          Apagar tudo
        </Button>
      </div>
    </Card>
  )
}
