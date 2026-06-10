import { useState, useEffect, useCallback } from 'react'
import { notificationsApi } from '../lib/api.js'

export function useNotifications(session) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchAll = useCallback(async () => {
    if (!session) return
    try {
      const { notifications: notifs, unreadCount: count } = await notificationsApi.getAll()
      setNotifications(notifs)
      setUnreadCount(count)
    } catch (e) {
      console.error('Failed to load notifications', e)
    }
  }, [session])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 60_000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const markAllRead = useCallback(async () => {
    await notificationsApi.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  const clearAll = useCallback(async () => {
    await notificationsApi.clear()
    setNotifications([])
    setUnreadCount(0)
  }, [])

  return { notifications, unreadCount, markAllRead, clearAll, refetch: fetchAll }
}
