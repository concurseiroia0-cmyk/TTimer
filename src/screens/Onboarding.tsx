// Mandatory first-launch onboarding. Cannot be skipped — without settings the
// app cannot compute a balance, so there is nothing to show.

import { useMemo, useState } from 'react'
import {
  computeSleepDuration,
  computeStartingBalance,
  secondsToHHmm,
  sleepDurationLabel,
  validateSettings,
} from '../engine/timebank'
import type { UserSettings } from '../state/types'
import { completeOnboarding } from '../state/store'
import { Button, Card, Motto, TimeField } from '../components/ui'

const STEPS = ['Nome', 'Sono', 'Trabalho', 'Refeições', 'Saldo']

export function Onboarding() {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [sleepStart, setSleepStart] = useState('22:00')
  const [wakeTime, setWakeTime] = useState('06:00')
  const [workHours, setWorkHours] = useState('8')
  const [mealsHours, setMealsHours] = useState('2')

  const draft = {
    name: name.trim(),
    sleepStart,
    wakeTime,
    workHoursPerDay: Number(workHours) || 0,
    mealsHygieneHours: Number(mealsHours) || 0,
    dayRenewsAt: wakeTime,
  }

  const validation = useMemo(() => validateSettings(draft), [sleepStart, wakeTime, workHours, mealsHours])
  const balanceSeconds = useMemo(() => computeStartingBalance(draft), [draft])
  const sleepLabel = sleepDurationLabel(sleepStart, wakeTime)

  const stepValid =
    step === 0
      ? name.trim().length > 0
      : step === 1
        ? computeSleepDuration(sleepStart, wakeTime) > 0
        : step === 2
          ? (Number(workHours) || 0) > 0
          : step === 3
            ? (Number(mealsHours) || 0) > 0
            : validation.ok

  function finish() {
    const settings: UserSettings = { ...draft, weeklyGoals: [] }
    completeOnboarding(settings)
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(env(safe-area-inset-top),16px)] pb-[max(env(safe-area-inset-bottom),16px)]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-accent">TTimer</p>
          <p className="text-xs text-muted">Configure seu banco de tempo</p>
        </div>
        <p className="text-xs text-muted">
          {step + 1}/{STEPS.length}
        </p>
      </div>

      {/* step dots */}
      <div className="mb-6 flex gap-1.5" aria-hidden>
        {STEPS.map((_, index) => (
          <div
            key={index}
            className={`h-1 flex-1 rounded-full transition-colors ${index <= step ? 'bg-accent' : 'bg-raised'}`}
          />
        ))}
      </div>

      <div className="flex-1">
        {step === 0 && (
          <Card>
            <h1 className="text-xl font-bold">Como devemos te chamar?</h1>
            <p className="mt-1 text-sm text-muted">Seu banco de tempo é pessoal. Vamos usar seu nome no painel.</p>
            <div className="mt-5">
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome"
                maxLength={40}
                className="tap-target w-full rounded-xl border border-line bg-raised px-4 text-base outline-none placeholder:text-muted/60 focus:border-accent/60"
              />
            </div>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <h1 className="text-xl font-bold">Seu sono</h1>
            <p className="mt-1 text-sm text-muted">
              O tempo dormindo não é investível. Durma bem — mas com conta corrente aberta.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <TimeField label="Dorme às" value={sleepStart} onChange={setSleepStart} />
              <TimeField label="Acorda às" value={wakeTime} onChange={setWakeTime} />
            </div>
            <p className="mt-4 rounded-xl border border-line bg-raised px-4 py-3 text-sm">
              Duração do sono: <span className="font-semibold text-accent">{sleepLabel}</span>
            </p>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <h1 className="text-xl font-bold">Trabalho / obrigações</h1>
            <p className="mt-1 text-sm text-muted">Horas por dia comprometidas com trabalho ou estudo obrigatório.</p>
            <div className="mt-5">
              <NumberStepper value={workHours} onChange={setWorkHours} suffix="horas / dia" min={0.5} max={16} step={0.5} />
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <h1 className="text-xl font-bold">Refeições e higiene</h1>
            <p className="mt-1 text-sm text-muted">Almoço, jantar, banho, academia da vida. Tudo que é rotina fixa.</p>
            <div className="mt-5">
              <NumberStepper value={mealsHours} onChange={setMealsHours} suffix="horas / dia" min={0.5} max={8} step={0.5} />
            </div>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <h1 className="text-xl font-bold">Seu saldo diário é {secondsToHHmm(balanceSeconds)}</h1>
            <p className="mt-1 text-sm text-muted">Todo dia esse valor é depositado e expira na renovação.</p>
            <div className="mt-5 space-y-2 text-sm">
              <BreakdownRow label="Horas do dia" value="24h" />
              <BreakdownRow label={`Sono (${sleepStart} → ${wakeTime})`} value={`- ${secondsToHHmm(computeSleepDuration(sleepStart, wakeTime))}`} />
              <BreakdownRow label="Trabalho / obrigações" value={`- ${secondsToHHmm((Number(workHours) || 0) * 3600)}`} />
              <BreakdownRow label="Refeições e higiene" value={`- ${secondsToHHmm((Number(mealsHours) || 0) * 3600)}`} />
              <div className="border-t border-line pt-2">
                <BreakdownRow label="Saldo investível / dia" value={secondsToHHmm(balanceSeconds)} strong />
              </div>
            </div>
            {!validation.ok && (
              <ul className="mt-4 space-y-1 text-sm text-danger">
                {validation.errors.map((error) => (
                  <li key={error}>• {error}</li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted">
              Seu dia renova às {wakeTime}. O que não for investido até lá desaparece.
            </p>
          </Card>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
            Voltar
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button variant="accent" block disabled={!stepValid} onClick={() => setStep((s) => s + 1)}>
            Continuar
          </Button>
        ) : (
          <Button variant="accent" block disabled={!validation.ok} onClick={finish}>
            Abrir minha conta
          </Button>
        )}
      </div>
      <Motto className="mt-4" />
    </div>
  )
}

function BreakdownRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? 'font-semibold text-fg' : 'text-muted'}>{label}</span>
      <span className={`font-mono tabular-nums ${strong ? 'text-lg font-bold text-accent' : 'text-fg'}`}>{value}</span>
    </div>
  )
}

function NumberStepper({
  value,
  onChange,
  suffix,
  min,
  max,
  step,
}: {
  value: string
  onChange: (value: string) => void
  suffix: string
  min: number
  max: number
  step: number
}) {
  const numeric = Number(value) || 0
  const clamp = (next: number) => Math.min(max, Math.max(min, next))
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-raised p-2">
      <button
        onClick={() => onChange(String(clamp(numeric - step)))}
        className="tap-target w-12 rounded-lg bg-panel text-2xl text-muted"
        aria-label="Diminuir"
      >
        −
      </button>
      <div className="text-center">
        <p className="font-mono text-2xl font-bold tabular-nums text-fg">{numeric.toString().replace('.', ',')}</p>
        <p className="text-xs text-muted">{suffix}</p>
      </div>
      <button
        onClick={() => onChange(String(clamp(numeric + step)))}
        className="tap-target w-12 rounded-lg bg-panel text-2xl text-muted"
        aria-label="Aumentar"
      >
        +
      </button>
    </div>
  )
}
