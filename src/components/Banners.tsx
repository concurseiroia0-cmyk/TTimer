// In-app banner stack: app events + best-effort reminders. If system
// notifications are unavailable, these banners are the honest fallback.

import { useEffect, useRef, useState } from 'react'
import { formatMinutesLabel } from '../engine/timebank'
import { getLastEvent, onAppEvent } from '../state/store'
import {
  requestNotificationPermission,
  sendNotification,
  notificationPermission,
} from '../state/notifications'

interface BannerItem {
  id: number
  tone: 'accent' | 'success' | 'danger'
  title: string
  body?: string
}

let nextBannerId = 1

export function Banners({
  remainingSeconds,
  renewsIn,
  investedTodaySeconds,
}: {
  remainingSeconds: number
  renewsIn: number
  investedTodaySeconds: number
}) {
  const [banners, setBanners] = useState<BannerItem[]>([])

  function pushBanner(banner: Omit<BannerItem, 'id'>) {
    const id = nextBannerId++
    setBanners((current) => [...current, { ...banner, id }])
    window.setTimeout(() => {
      setBanners((current) => current.filter((b) => b.id !== id))
    }, 6000)
  }

  // System notifications for lifecycle events (only when permitted).
  useEffect(() => {
    return onAppEvent((event) => {
      if (event.type === 'balance-exhausted') {
        sendNotification('TTimer', 'Saldo esgotado. Volta quando o dia renovar.')
      }
      if (event.type === 'session-completed') {
        sendNotification('TTimer', `${event.activityName}: compra concluída. Rendimento garantido.`)
      }
      if (event.type === 'day-renewed') {
        sendNotification('TTimer', `Seu saldo renovou. Você tem ${formatMinutesLabel(event.balanceSeconds)} pra investir hoje.`)
      }
    })
  }, [])

  // Permission nudge + reminder rules, checked every 30s.
  useEffect(() => {
    if (notificationPermission() === 'default') {
      const id = window.setTimeout(() => {
        pushBanner({
          tone: 'accent',
          title: 'Ativar lembretes?',
          body: 'Podemos avisar quando o saldo renovar ou estiver perto de expirar.',
        })
        void requestNotificationPermission()
      }, 2500)
      return () => window.clearTimeout(id)
    }
  }, [])

  // Reminder rules re-check periodically, but each rule fires at most once
  // per app run (no notification spam while the app sits open).
  const firedRef = useRef<Record<string, boolean>>({})
  useEffect(() => {
    const check = () => {
      // Balance expiring in <= 2h and there is still something meaningful left.
      if (remainingSeconds > 30 * 60 && renewsIn <= 2 * 3600 && renewsIn > 0 && !firedRef.current.expiring) {
        firedRef.current.expiring = true
        pushBanner({
          tone: 'danger',
          title: `${formatMinutesLabel(remainingSeconds)} vão expirar em breve`,
          body: 'Vai deixar esse saldo morrer?',
        })
      }
      // Long idle stretch without any investment today.
      if (investedTodaySeconds === 0 && renewsIn > 3 * 3600 && remainingSeconds > 0 && !firedRef.current.idle) {
        firedRef.current.idle = true
        pushBanner({
          tone: 'accent',
          title: 'Sua conta está parada',
          body: 'Já faz um bom tempo que nada foi investido hoje.',
        })
      }
    }
    const interval = window.setInterval(check, 30_000)
    return () => window.clearInterval(interval)
  })

  // Show the last app event as an in-app banner too (honest fallback).
  useEffect(() => {
    const event = getLastEvent()
    if (!event) return
    if (event.type === 'balance-exhausted') {
      pushBanner({ tone: 'danger', title: 'Saldo esgotado', body: 'Volta quando o dia renovar.' })
    }
  }, [remainingSeconds])

  if (banners.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-3 top-[max(env(safe-area-inset-top),12px)] z-50 space-y-2">
      {banners.map((banner) => (
        <div
          key={banner.id}
          className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md ${
            banner.tone === 'danger'
              ? 'border-danger/50 bg-danger/15 text-danger'
              : banner.tone === 'success'
                ? 'border-success/50 bg-success/15 text-success'
                : 'border-accent/50 bg-accent/15 text-accent'
          }`}
          role="status"
        >
          <p className="text-sm font-semibold">{banner.title}</p>
          {banner.body && <p className="text-xs opacity-90">{banner.body}</p>}
        </div>
      ))}
    </div>
  )
}
