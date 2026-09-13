// Screen 2 — Comprar Tempo: pick an activity, pick a duration, confirm the purchase.

import { useState } from 'react'
import { secondsToHHmm, secondsToHHMMSS } from '../engine/timebank'
import type { ActivityTemplate, DayState } from '../state/types'
import { addCustomTemplate, startSession } from '../state/store'
import { BalanceBar, Button, Card, SectionTitle } from '../components/ui'

const DURATION_OPTIONS = [10, 15, 25, 30, 45, 60, 90]
const CUSTOM_ID = '__custom__'

export function Comprar({
  day,
  templates,
  onGoTimer,
}: {
  day: DayState
  templates: ActivityTemplate[]
  onGoTimer: (sessionId: string) => void
}) {
  const remaining = Math.max(0, day.remainingBalanceSeconds)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [customName, setCustomName] = useState('')
  const [minutes, setMinutes] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = templates.find((t) => t.id === selectedId) ?? null
  const isCustom = selectedId === CUSTOM_ID
  const activityName = isCustom ? customName.trim() : (selected?.name ?? '')
  const activityEmoji = isCustom ? '➕' : (selected?.emoji ?? '➕')
  const costSeconds = (minutes ?? 0) * 60
  const afterBalance = Math.max(0, remaining - costSeconds)
  const insufficient = costSeconds > remaining
  const ready = activityName.length > 0 && costSeconds > 0

  const quickMinutes = (() => {
    const list = [...DURATION_OPTIONS]
    if (selected && !list.includes(selected.defaultMinutes) && selected.defaultMinutes > 0) {
      list.unshift(selected.defaultMinutes)
    }
    return list
  })()

  function confirm() {
    if (!ready || insufficient) return
    let activityId: string
    if (isCustom) {
      const created = addCustomTemplate({
        id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        emoji: '➕',
        name: activityName,
        defaultMinutes: minutes ?? 25,
      })
      activityId = created.id
    } else {
      activityId = selected!.id
    }
    const session = startSession({
      activityId,
      activityName,
      emoji: activityEmoji,
      plannedSeconds: costSeconds,
    })
    if (!session) {
      setError('Não foi possível iniciar a compra. Tente novamente.')
      return
    }
    setSelectedId(null)
    setCustomName('')
    setMinutes(null)
    setError(null)
    onGoTimer(session.id)
  }

  return (
    <div className="space-y-5">
      <section>
        <p className="text-lg font-semibold">Comprar tempo</p>
        <p className="text-xs text-muted">Troque saldo por atividades de crescimento. O débito é em tempo real.</p>
      </section>

      <SectionTitle>O que você vai investir?</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {templates.map((template) => {
          const isSelected = selectedId === template.id
          return (
            <button
              key={template.id}
              onClick={() => {
                setSelectedId(template.id)
                setMinutes(template.defaultMinutes)
                setError(null)
                requestAnimationFrame(() =>
                  document.getElementById('duration-picker')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
                )
              }}
              className={`flex min-h-[76px] flex-col items-start gap-0.5 rounded-2xl border p-3 text-left transition-colors ${
                isSelected ? 'bg-accent/15 text-accent' : 'bg-panel text-fg'
              }`}
            >
              <span className="text-xl" aria-hidden>
                {template.emoji}
              </span>
              <span className="text-sm leading-tight font-medium">{template.name}</span>
              <span className="text-[11px] text-muted">{template.defaultMinutes}min sugeridos</span>
            </button>
          )
        })}
      </div>

      {/* Custom activity creator */}
      <div className={`rounded-2xl p-3 ${isCustom ? 'bg-accent/15' : 'bg-panel'}`}>
        <label className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>
            ➕
          </span>
          <input
            value={customName}
            onFocus={() => setSelectedId(CUSTOM_ID)}
            onChange={(event) => {
              setCustomName(event.target.value)
              setSelectedId(event.target.value.trim() ? CUSTOM_ID : null)
              setError(null)
            }}
            placeholder="Criar atividade personalizada…"
            maxLength={40}
            className="tap-target min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/60"
          />
        </label>
        {isCustom && customName.trim() && (
          <p className="mt-1 px-0.5 text-[11px] text-muted">Salva na sua lista para as próximas compras.</p>
        )}
      </div>

      {/* Duration picker + live preview */}
      <div id="duration-picker" className="space-y-3">
        <SectionTitle>Quanto custa?</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {quickMinutes.map((option) => (
            <button
              key={option}
              onClick={() => {
                setMinutes(option)
                setError(null)
              }}
              className={`tap-target rounded-xl border px-4 text-sm font-medium tabular-nums transition-colors ${
                minutes === option ? 'bg-accent/15 text-accent' : 'bg-panel text-fg'
              }`}
            >
              {option}min
            </button>
          ))}
          <input
            type="number"
            min={1}
            max={720}
            inputMode="numeric"
            value={minutes ?? ''}
            onChange={(event) => {
              const value = Number(event.target.value)
              setMinutes(Number.isFinite(value) && value > 0 ? Math.floor(value) : null)
              setError(null)
            }}
            placeholder="custom"
            className="tap-target w-24 rounded-xl bg-panel px-3 text-sm tabular-nums outline-none focus:border-accent/60"
            aria-label="Minutos personalizados"
          />
        </div>

        <Card>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Custo:</span>
            <span className="font-mono text-base font-semibold tabular-nums text-fg">{secondsToHHmm(costSeconds)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-muted">Saldo após compra:</span>
            <span
              className={`font-mono text-base font-semibold tabular-nums ${
                insufficient ? 'text-danger' : 'text-accent'
              }`}
            >
              {secondsToHHMMSS(afterBalance)}
            </span>
          </div>
          {insufficient && (
            <p className="mt-2 text-xs text-danger">
              Compra bloqueada: faltam {secondsToHHmm(costSeconds - remaining)} de saldo.
            </p>
          )}
          <div className="mt-3">
            <BalanceBar ratio={remaining > 0 ? afterBalance / remaining : 0} tone={insufficient ? 'danger' : 'accent'} />
          </div>

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          <Button
            variant="accent"
            block
            className="mt-4"
            disabled={!ready || insufficient}
            onClick={confirm}
          >
            {insufficient
              ? 'Saldo insuficiente'
              : !ready
                ? 'Escolha atividade e duração'
                : `Confirmar compra de ${secondsToHHmm(costSeconds)}`}
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted">
            Ao confirmar, o cronômetro inicia e o saldo passa a cair em tempo real.
          </p>
        </Card>
      </div>
    </div>
  )
}
