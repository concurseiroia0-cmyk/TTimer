// Best-effort local notifications. If the browser cannot deliver background
// notifications we say so honestly and rely on in-app banners instead.

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

/** Fire a system notification when (and only when) permission allows it. */
export function sendNotification(title: string, body: string): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  try {
    const notification = new Notification(title, { body, icon: 'icons/icon-192.png', tag: `timebank-${title}` })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } catch {
    // Some browsers restrict constructors — ignore, banner is shown anyway.
  }
}
