// Screen 1 — Hoje: the daily dashboard with the live investible balance.

import { useEffect, useState } from 'react'
import {
  effectiveBalanceSeconds,
  formatMinutesLabel,
  investedSeconds,
  secondsToHHmm,
  secondsToHHMMSS,
  secondsUntilRenew,
} from '../engine/timebank'
import type { DayState, UserSettings } from '../state/types'
import { SummaryGauge } from '../components/SummaryGauge'
import { Card, EmptyState, Motto, SectionTitle, StatusIcon, Button } from '../components/ui'

const URGENT_WINDOW_SECONDS = 3 * 3600
const URGENT_MINIMUM_BALANCE = 30 * 60

export function Hoje({
  settings,
  day,
  onGoBuy,
  onOpenTimer,
}: {
  settings: UserSettings
  day: DayState
  onGoBuy: () => void
  onOpenTimer: (sessionId: string) => void
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const invested = investedSeconds(day.sessions)
  const ledger = Math.max(0, day.remainingBalanceSeconds)
  const starting = day.startingBalanceSeconds
  const renewsIn = secondsUntilRenew(settings.dayRenewsAt, now)
  // The balance melts with the clock: never more than the time left today.
  const remaining = effectiveBalanceSeconds(starting, day.sessions, renewsIn)

  const running = day.sessions.find((s) => s.status === 'running')
  const showUrgency =
    running == null &&
    ledger > URGENT_MINIMUM_BALANCE &&
    renewsIn < URGENT_WINDOW_SECONDS &&
    renewsIn > 0 &&
    starting > 0


  return (
    <div className="space-y-5">
      {/* Hero: circular gauge (Summary style) — everything inside the ring */}
      <section>
        <SummaryGauge
          remainingSeconds={remaining}
          startingSeconds={starting}
          renewsIn={renewsIn}
          renewLabel={`${secondsToHHMMSS(renewsIn)} até o dia renovar`}
        />
      </section>

      {showUrgency && (
        <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          Você ainda tem <span className="font-semibold">{formatMinutesLabel(remaining)}</span> de saldo que vão expirar.
          Vai deixar morrer?
        </div>
      )}

      {starting === 0 && (
        <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          Saldo esgotado por configuração: sono + trabalho + refeições fecham 24h. Ajuste em <b>Eu</b> para liberar saldo.
        </div>
      )}

      {starting > 0 && remaining === 0 && !running && (
        <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
          Saldo esgotado. Volta quando o dia renovar.
        </div>
      )}

      {/* Running session as primary CTA */}
      {running && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted">Em andamento</p>
              <p className="truncate text-base font-semibold">
                {running.emoji} {running.activityName}
              </p>
              <p className="font-mono text-sm tabular-nums text-accent">
                {secondsToHHMMSS(Math.max(0, running.plannedSeconds - running.elapsedSeconds))} restantes
              </p>
            </div>
            <Button variant="accent" onClick={() => onOpenTimer(running.id)}>
              Abrir cronômetro
            </Button>
          </div>
        </Card>
      )}

      {/* Totals */}
      <section>
        <SectionTitle>Balanço de hoje</SectionTitle>
        <Card>
          <div className="grid grid-cols-2 gap-3">
            <TotalTile label="Investido" value={formatMinutesLabel(invested)} tone="success" />
            <TotalTile label="Desperdiçado" value={formatMinutesLabel(Math.max(0, starting - invested))} tone="danger" />
          </div>
          <p className="mt-3 text-center text-xs text-muted">
            {starting > 0 && invested >= starting
              ? 'Dia 100% investido. 🏆'
              : `Todo saldo não investido evapora à meia-noite.`}
          </p>
        </Card>
      </section>

      {/* Purchases */}
      <section>
        <SectionTitle action={<span className="text-xs text-muted">{day.sessions.length} compras</span>}>
          Suas compras de hoje
        </SectionTitle>
        {day.sessions.length === 0 ? (
          <EmptyState
            emoji="⏳"
            title="Nenhuma compra ainda"
            description="Comprar tempo é trocar minutos do seu saldo por uma atividade de crescimento — o cronômetro debita em tempo real."
            action={
              <Button variant="accent" className="mt-2" onClick={onGoBuy}>
                + Comprar tempo
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {day.sessions.map((session) => {
              return (
                <Card key={session.id} className="!p-0">
                  <button
                    onClick={() => onOpenTimer(session.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="text-xl" aria-hidden>
                      {session.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{session.activityName}</span>
                      <span className="block text-xs text-muted">
                        {secondsToHHmm(session.plannedSeconds)} planejados ·{' '}
                        {session.status === 'completed' ? 'investidos' : `${formatMinutesLabel(session.elapsedSeconds)} debitados`}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-mono text-sm tabular-nums text-fg">{secondsToHHmm(session.elapsedSeconds)}</span>
                      <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted">
                        <StatusIcon status={session.status} />
                        {session.status === 'completed'
                          ? 'concluído'
                          : session.status === 'running'
                            ? 'em andamento'
                            : session.status === 'paused'
                              ? 'pausado'
                              : 'abandonou'}
                      </span>
                    </span>
                    {session.status === 'running' && (
                      <span className="font-mono text-xs tabular-nums text-accent">
                        faltam {secondsToHHmm(Math.max(0, session.plannedSeconds - session.elapsedSeconds))}
                      </span>
                    )}
                  </button>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <Motto className="pt-2" />
    </div>
  )
}

function TotalTile({ label, value, tone }: { label: string; value: string; tone: 'success' | 'danger' }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${tone === 'success' ? 'bg-success/10' : 'bg-danger/10'}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`font-mono text-xl font-bold tabular-nums ${tone === 'success' ? 'text-success' : 'text-danger'}`}>{value}</p>
    </div>
  )
}
