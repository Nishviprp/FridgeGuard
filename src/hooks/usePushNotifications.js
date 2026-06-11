/**
 * usePushNotifications
 *
 * Handles the full Web Push lifecycle:
 *   1. Register the service worker (once, on first use)
 *   2. Subscribe to push using VITE_VAPID_PUBLIC_KEY from the build env
 *   3. Save the subscription object to Supabase via /api/push-subscription
 *   4. Unsubscribe and clean up on demand
 *
 * VAPID public key comes from import.meta.env.VITE_VAPID_PUBLIC_KEY.
 * Add it to your .env.local AND to Netlify environment variables.
 * (Same value as VAPID_PUBLIC_KEY — just needs the VITE_ prefix so Vite
 * injects it into the browser bundle at build time.)
 */
import { useState, useEffect, useCallback } from 'react'
import { pushApi } from '../lib/api.js'

// ── urlBase64ToUint8Array ─────────────────────────────────────────────────────
// Converts a base64url VAPID public key to the Uint8Array that
// PushManager.subscribe() requires as applicationServerKey.
// Uses an explicit for-loop (not spread+map) for maximum compatibility.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// ── registerServiceWorker ─────────────────────────────────────────────────────
// Singleton — avoid re-registering on every subscribe() call.
let swRegistration = null

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  if (swRegistration) return swRegistration
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready   // block until the SW is active
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
    'PushManager'   in window &&
    'Notification'  in window

  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  // On mount: detect whether a push subscription already exists
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
    if (!isSupported) {
      setError('Push notifications are not supported in this browser')
      return false
    }

    setLoading(true)
    setError('')

    try {
      // 1. Request notification permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Please allow notifications in your browser settings')
        return false
      }

      // 2. Ensure service worker is registered and active
      const reg = await registerServiceWorker()
      if (!reg) {
        setError('Service worker registration failed')
        return false
      }

      // 3. Read VAPID public key from the build-time env (synchronous, no round-trip)
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        setError('Push notifications not configured (missing VAPID key)')
        return false
      }

      // 4. Subscribe via PushManager
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      // 5. Persist subscription to Supabase
      await pushApi.save(subscription.toJSON())
      setIsSubscribed(true)
      return true
    } catch (err) {
      console.error('Push subscribe error:', err)
      setError(err.message)   // show the raw browser/API error directly
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
      setError(err.message)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return { isSupported, isSubscribed, loading, error, subscribe, unsubscribe }
}
