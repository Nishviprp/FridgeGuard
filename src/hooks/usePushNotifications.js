/**
 * usePushNotifications
 *
 * Handles the full Web Push lifecycle:
 *   1. Register the service worker (once, on first use)
 *   2. Subscribe to push with VAPID key fetched from the API
 *   3. Save the subscription object to Supabase via /api/push-subscription
 *   4. Unsubscribe and clean up on demand
 *
 * The VAPID public key is fetched from GET /api/push-subscription rather than
 * baked into the frontend bundle (avoids a separate VITE_VAPID_PUBLIC_KEY var).
 */
import { useState, useEffect, useCallback } from 'react'
import { pushApi } from '../lib/api.js'

// ── urlBase64ToUint8Array ─────────────────────────────────────────────────────
// Converts the VAPID public key from base64url to Uint8Array as required by
// the PushManager.subscribe() call.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(base64)
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)))
}

// ── registerServiceWorker ─────────────────────────────────────────────────────
let swRegistration = null   // singleton — don't re-register on every call

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  if (swRegistration) return swRegistration
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready   // wait until active
    return swRegistration
  } catch (err) {
    console.error('SW registration failed:', err)
    return null
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function usePushNotifications() {
  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  const [isSubscribed,  setIsSubscribed]  = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')

  // On mount: check if already subscribed
  useEffect(() => {
    if (!isSupported) return
    ;(async () => {
      const reg = await registerServiceWorker()
      if (!reg) return
      const existing = await reg.pushManager.getSubscription()
      setIsSubscribed(!!existing)
    })()
  }, [isSupported])

  // ── subscribe ───────────────────────────────────────────────────────────────
  const subscribe = useCallback(async () => {
    if (!isSupported) { setError('Push notifications are not supported in this browser'); return false }
    setLoading(true)
    setError('')

    try {
      // 1. Request notification permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Notification permission denied. Enable it in your browser settings.')
        return false
      }

      // 2. Register service worker + get push manager
      const reg = await registerServiceWorker()
      if (!reg) { setError('Service worker registration failed'); return false }

      // 3. Fetch VAPID public key from API
      const { publicKey } = await pushApi.getVapidKey()
      if (!publicKey) { setError('VAPID public key not configured. Add VAPID_PUBLIC_KEY to env vars.'); return false }

      // 4. Subscribe
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      // 5. Save to Supabase
      await pushApi.save(subscription.toJSON())
      setIsSubscribed(true)
      return true
    } catch (err) {
      console.error('Push subscribe error:', err)
      setError(err.message || 'Failed to enable push notifications')
      return false
    } finally {
      setLoading(false)
    }
  }, [isSupported])

  // ── unsubscribe ─────────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const reg = await registerServiceWorker()
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) await sub.unsubscribe()
      }
      await pushApi.remove()
      setIsSubscribed(false)
      return true
    } catch (err) {
      console.error('Push unsubscribe error:', err)
      setError(err.message || 'Failed to disable push notifications')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return { isSupported, isSubscribed, loading, error, subscribe, unsubscribe }
}
