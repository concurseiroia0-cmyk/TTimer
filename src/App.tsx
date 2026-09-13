// App shell: hydration, mandatory onboarding gate, bottom navigation and the
// three content screens (Hoje, Comprar, Extrato) plus fullscreen Cronômetro.

import { useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import {
  computeStartingBalance,
  createDayState,
  investedSeconds,
  secondsUntilRenew,
  todayDateKey,
} from './engine/timebank'
import { hydrate, bootstrapDay, flushPersist } from './state/store'
import { buildDemoData } from './state/demo'
import {
  useAppData,
  useHydrated,
  selectMergedTemplates,
  selectToday,
} from './state/useAppData'
import { BalanceHeader } from './components/BalanceHeader'
import { Banners } from './components/Banners'
import { Hoje } from './screens/Hoje'
import { Comprar } from './screens/Comprar'
import { Extrato } from './screens/Extrato'
import { Eu } from './screens/Eu'
import { Timer } from './screens/Timer'
import { Onboarding } from './screens/Onboarding'
import type { DayState } from './engine/timebank'

type Tab = 'hoje' | 'comprar' | 'extrato' | 'eu'

interface NavProps {
  active: Tab
  onGo: (tab: Tab) => void
}

const NAV_ITEMS: { id: Tab; label: string; icon: (active: boolean) => ReactElement }[] = [
  {
    id: 'hoje',
    label: 'Hoje',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <rect x="4" y="4" width="7" height="7" rx="2" />
        <rect x="13" y="4" width="7" height="7" rx="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" />
        <rect x="13" y="13" width="7" height="7" rx="2" />
      </svg>
    ),
  },
  {
    id: 'comprar',
    label: 'Comprar',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <rect x="4" y="5" width="16" height="16" rx="3" />
        <path d="M12 9v6M9 12h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'extrato',
    label: 'Extrato',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <path d="M4 19V10M9 19V5M14 19v-8M19 19v-4" strokeLinecap="round" strokeWidth={active ? 2.4 : 1.8} />
      </svg>
    ),
  },
  {
    id: 'eu',
    label: 'Eu',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
        <path d="M8 10h8M8 14h5" strokeLinecap="round" strokeWidth={active ? 2.4 : 1.8} />
        <path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 17 18H9l-4.5 3v-14Z" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export function App() {
  const hydrated = useHydrated()
  const data = useAppData()
  const [tab, setTab] = useState<Tab>('hoje')
  const [timerSessionId, setTimerSessionId] = useState<string | null>(null)

  // Bootstrap once: hydration, demo seed (?demo=1), persistence hooks.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('demo') && !localStorage.getItem('timebank:v1')) {
      localStorage.setItem('timebank:v1', JSON.stringify(buildDemoData()))
    }
    hydrate()
    const onVisibility = () => flushPersist()
    const onBeforeUnload = () => flushPersist()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  const settings = data.settings
  const todayKey = settings ? todayDateKey(settings.dayRenewsAt) : ''
  const day = useMemo(() => selectToday(settings, data.days), [settings, data.days])

  const remaining = day ? Math.max(0, day.remainingBalanceSeconds) : 0
  const renewsIn = settings ? secondsUntilRenew(settings.dayRenewsAt) : 0

  // Keep re-calculating "today" so renewal is picked up even if the scheduler
  // timeout fired while the tab was frozen.
  useEffect(() => {
    if (!hydrated || !settings) return
    const id = window.setInterval(() => bootstrapDay(), 30_000)
    return () => window.clearInterval(id)
  }, [hydrated, settings])

  if (!hydrated) {
    return <Splash />
  }

  // Onboarding is mandatory: without settings there is no balance to show.
  if (!settings || !data.onboarded) {
    return <Onboarding />
  }

  if (timerSessionId) {
    // Fullscreen focus mode replaces the shell (no header, no bottom nav).
    const timerDay: DayState = day ?? createDayState(todayKey, computeStartingBalance(settings))
    return <Timer day={timerDay} sessionId={timerSessionId} onExit={() => setTimerSessionId(null)} />
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col md:max-w-lg">
      <BalanceHeader
        title={tab === 'hoje' ? 'Olá, ' + settings.name.split(' ')[0] : tab === 'comprar' ? 'Comprar' : tab === 'extrato' ? 'Extrato' : 'Eu'}
        remainingSeconds={remaining}
        renewsIn={renewsIn}
        onClick={() => setTab('eu')}
      />
      <main key={tab} className="screen-in flex-1 px-4 pt-4 pb-[calc(112px+env(safe-area-inset-bottom))]">
        {tab === 'hoje' && day && (
          <Hoje
            settings={settings}
            day={day}
            onGoBuy={() => setTab('comprar')}
            onOpenTimer={(sessionId) => setTimerSessionId(sessionId)}
          />
        )}
        {tab === 'comprar' && day && (
          <Comprar
            day={day}
            templates={selectMergedTemplates(data)}
            onGoTimer={(sessionId) => setTimerSessionId(sessionId)}
          />
        )}
        {tab === 'extrato' && <Extrato data={data} />}
        {tab === 'eu' && day && (
          <Eu data={data} day={day} templates={selectMergedTemplates(data)} todayKey={todayKey} />
        )}
      </main>
      <BottomNav active={tab} onGo={setTab} />
      <Banners
        remainingSeconds={remaining}
        renewsIn={renewsIn}
        investedTodaySeconds={day ? investedSeconds(day.sessions) : 0}
      />
    </div>
  )
}

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2">
      <p className="font-mono text-3xl font-bold text-accent">TTimer</p>
      <p className="text-xs text-muted">Você não gasta tempo. Você investe tempo.</p>
    </div>
  )
}

function BottomNav({ active, onGo }: NavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-4 pb-[max(env(safe-area-inset-bottom),12px)] md:max-w-lg"
      aria-label="Navegação principal"
    >
      <div className="glass-nav relative grid grid-cols-4 gap-1 rounded-full p-1.5 backdrop-blur-2xl backdrop-saturate-150">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onGo(item.id)}
              className="tap-target relative z-10 flex flex-col items-center justify-center gap-0.5 rounded-full py-2"
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
            >
              {item.icon(isActive)}
            </button>
          )
        })}
        <span
          aria-hidden
          className="glass-pill pointer-events-none absolute inset-y-1.5 z-0 rounded-full"
          style={{
            width: `calc((100% - 12px) / 4)`,
            left: `calc(6px + (100% - 12px) / 4 * ${NAV_ITEMS.findIndex((it) => it.id === active)})`,
          }}
        />
      </div>
    </nav>
  )
}
