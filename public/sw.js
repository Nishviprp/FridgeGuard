/**
 * FridgeGuard Service Worker
 * Handles background push notifications and offline caching.
 */

const CACHE_VERSION = 'v1'

// ── Push: show notification ───────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return

  let data = {}
  try {
    data = event.data.json()
  } catch {
    data = { title: 'FridgeGuard', body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'FridgeGuard', {
      body:      data.body  || 'You have a new fridge reminder.',
      icon:      data.icon  || '/icon-192.png',
      badge:     data.badge || '/badge-72.png',
      tag:       data.tag   || 'expiry-alert',
      renotify:  true,
      data:      { url: data.url || self.location.origin },
      // Actions shown on Android / some desktop browsers
      actions: [
        { action: 'view',    title: 'View Fridge' },
        { action: 'dismiss', title: 'Dismiss'     },
      ],
    })
  )
})

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const targetUrl = event.notification.data?.url || self.location.origin

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing tab if open
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return client.focus()
          }
        }
        // Otherwise open a new tab
        return clients.openWindow(targetUrl)
      })
  )
})

// ── Install / Activate: skip waiting so updates apply immediately ─────────────
self.addEventListener('install',  () => self.skipWaiting())
self.addEventListener('activate', event => {
  event.waitUntil(
    // Clean up old caches from previous versions
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})
