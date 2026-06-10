/**
 * FridgeGuard Service Worker
 * Handles background push notifications
 */

self.addEventListener('push', event => {
  if (!event.data) return

  let data = {}
  try { data = event.data.json() } catch { data = { title: 'FridgeGuard', body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(data.title || 'FridgeGuard', {
      body: data.body || 'You have a new reminder.',
      icon: data.icon || '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'fridgeguard-reminder',
      renotify: true,
      data: { url: self.location.origin },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow(event.notification.data?.url || self.location.origin)
    })
  )
})
