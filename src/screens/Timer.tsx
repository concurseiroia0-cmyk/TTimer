// Screen 3 — Cronômetro: fullscreen focus mode, one-hand operable.

import { useEffect, useMemo, useRef, useState } from 'react'
import { secondsToHHmm, secondsToHHMMSS } from '../engine/timebank'
import type { DayState, Session } from '../state/types'
import { abandonSessionById, notifySessionCompleted, pauseSessionById, resumeSessionById } from '../state/store'
import { Button } from '../components/ui'

const QUOTES = [
  'Cada minuto investido é um minuto que ninguém pode tirar de você.',
  'Tempo investido rende juros que dinheiro nenhum paga.',
  'O saldo vai zerar hoje de qualquer forma. A questão é onde.',
  'Pequenos depósitos diários viram uma fortuna de habilidades.',
  'Você não precisa de mais horas. Precisa de mais intenção.',
  'Disciplina é pagar a si mesmo primeiro.',
  'Amanhã o saldo renova. Hoje ainda dá tempo de investir.',
]

const COMPLETION_LINES = [
  'Compra concluída. Rendimento garantido.',
  'Depósito efetuado no seu futuro.',
  'Investimento encerrado com lucro.',
]

/** Best-effort Screen Wake Lock while a session runs. */
function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null)
  useEffect(() => {
    let cancelled = false
    async function acquire() {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> } }
        if (!nav.wakeLock || document.visibilityState !== 'visible') return
        const sentinel = await nav.wakeLock.request('screen')
        if (cancelled) {
          void sentinel.release()
          return
        }
        lockRef.current = sentinel
      } catch {
        // Wake Lock unsupported or denied — timer keeps working anyway.
      }
    }
    function release() {
      void lockRef.current?.release()
      lockRef.current = null
    }
    if (active) {
      void acquire()
      const onVisible = () => {
        if (document.visibilityState === 'visible' && lockRef.current == null) void acquire()
      }
      document.addEventListener('visibilitychange', onVisible)
      return () => {
        cancelled = true
        document.removeEventListener('visibilitychange', onVisible)
        release()
      }
    }
    release()
  }, [active])
}

export function Timer({
  day,
  sessionId,
  onExit,
}: {
  day: DayState
  sessionId: string
  onExit: () => void
}) {
  const session = day.sessions.find((s) => s.id === sessionId) ?? null
  const [confirmEnd, setConfirmEnd] = useState(false)

  if (!session) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted">Esta sessão não existe mais.</p>
        <Button variant="accent" onClick={onExit}>
          Voltar ao painel
        </Button>
      </div>
    )
  }

  return <TimerInner session={session} day={day} confirmEnd={confirmEnd} setConfirmEnd={setConfirmEnd} onExit={onExit} />
}

function TimerInner({
  session,
  day,
  confirmEnd,
  setConfirmEnd,
  onExit,
}: {
  session: Session
  day: DayState
  confirmEnd: boolean
  setConfirmEnd: (value: boolean) => void
  onExit: () => void
}) {
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])
  const [completionLine] = useState(() => COMPLETION_LINES[Math.floor(Math.random() * COMPLETION_LINES.length)])
  const [celebrated, setCelebrated] = useState(session.status === 'completed')
  const celebratedRef = useRef(session.status === 'completed')

  const running = session.status === 'running'
  const paused = session.status === 'paused'
  const finished = session.status === 'completed'
  const abandoned = session.status === 'abandoned'

  const sessionRemaining = Math.max(0, session.plannedSeconds - session.elapsedSeconds)
  const balanceRemaining = Math.max(0, day.remainingBalanceSeconds)
  const exhausted = abandoned && balanceRemaining <= 0

  useWakeLock(running)

  // Fire the celebration exactly once when the session completes.
  useEffect(() => {
    if (finished && !celebratedRef.current) {
      celebratedRef.current = true
      setCelebrated(true)
      notifySessionCompleted(session.activityName)
    }
  }, [finished, session.activityName])

  const progress = session.plannedSeconds > 0 ? 1 - sessionRemaining / session.plannedSeconds : 1

  const countdownColor = useMemo(() => {
    if (finished) return 'text-success'
    if (exhausted) return 'text-danger'
    return 'text-accent'
  }, [finished, exhausted])

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(env(safe-area-inset-top),20px)] pb-[max(env(safe-area-inset-bottom),20px)]">
      {/* header row */}
      <div className="flex items-center justify-between">
        <button
          onClick={onExit}
          className="tap-target rounded-xl px-3 text-sm text-muted transition-colors hover:text-fg"
          aria-label="Voltar ao painel"
        >
          ← Painel
        </button>
        <p className="text-[11px] tracking-[0.14em] text-muted uppercase">
          {running ? 'Sessão em andamento' : paused ? 'Pausada' : finished ? 'Concluída' : 'Encerrada'}
        </p>
        <span className="w-[72px]" aria-hidden />
      </div>

      {celebrated && finished ? (
        /* ---------------- celebration ---------------- */
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="text-6xl" aria-hidden>
            🎉
          </span>
          <p className="text-2xl font-bold text-success">{completionLine}</p>
          <p className="text-sm text-muted">
            {session.emoji} {session.activityName} · {secondsToHHmm(session.elapsedSeconds)} investidos
          </p>
          <p className="mt-4 max-w-[34ch] text-sm italic text-muted">“{quote}”</p>
          <Button variant="accent" block className="mt-6 max-w-xs" onClick={onExit}>
            Voltar ao painel
          </Button>
        </div>
      ) : (
        <>
          {/* ---------------- countdown ---------------- */}
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
            <span className="text-5xl" aria-hidden>
              {session.emoji}
            </span>
            <p className="mt-2 text-base font-medium">{session.activityName}</p>

            <p
              className={`mt-3 font-mono text-[72px] leading-none font-bold tracking-tight ${countdownColor}`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
              aria-live="off"
            >
              {secondsToHHMMSS(sessionRemaining)}
            </p>
            <p className="text-xs text-muted">restantes nesta sessão</p>

            {/* progress ring substitute: thin bar */}
            <div className="mt-5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-raised">
              <div
                className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${finished ? 'bg-success' : 'bg-accent'}`}
                style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
              />
            </div>

            <div className="mt-6 rounded-xl bg-panel px-4 py-2">
              <p className="text-[10px] tracking-[0.14em] text-muted uppercase">Saldo do dia</p>
              <p className="font-mono text-xl font-bold tabular-nums text-fg">{secondsToHHMMSS(balanceRemaining)}</p>
            </div>

            {exhausted && (
              <p className="mt-4 max-w-[32ch] text-sm text-danger">
                Saldo esgotado. A sessão foi encerrada e o tempo investido foi debitado. Volta quando o dia renovar.
              </p>
            )}
          </div>

          {/* ---------------- one-hand controls ---------------- */}
          <div className="sticky bottom-[max(env(safe-area-inset-bottom),16px)] space-y-2">
            {confirmEnd ? (
              <div className="rounded-2xl bg-danger/10 p-4">
                <p className="text-sm text-fg">
                  Encerrar agora? O tempo já investido será debitado e a sessão fica como abandonada se não completou.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="ghost" onClick={() => setConfirmEnd(false)}>
                    Continuar
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      abandonSessionById(session.id)
                      onExit()
                    }}
                  >
                    Encerrar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="accent"
                block
                className="h-16 rounded-2xl text-lg"
                disabled={finished || abandoned}
                onClick={() => {
                  if (running) pauseSessionById(session.id)
                  else if (paused) resumeSessionById(session.id)
                }}
              >
                {running ? '⏸ Pausar' : paused ? '▶ Retomar' : 'Sessão encerrada'}
              </Button>
            )}
            {!confirmEnd && !finished && !abandoned && (
              <Button variant="danger" block className="h-12 rounded-2xl" onClick={() => setConfirmEnd(true)}>
                Encerrar
              </Button>
            )}
            {(finished || abandoned) && (
              <Button variant="ghost" block className="h-12 rounded-2xl" onClick={onExit}>
                Voltar ao painel
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
