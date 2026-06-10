import { useState, useEffect, useCallback } from 'react'
import { settingsApi } from '../lib/api.js'

export function useSettings(session) {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    if (!session) return
    try {
      const data = await settingsApi.getAll()
      setSettings(data)
    } catch (e) {
      console.error('Failed to load settings', e)
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const updateSetting = useCallback(async (key, value) => {
    setSettings(prev => ({ ...prev, [key]: String(value) }))
    await settingsApi.update({ [key]: value })
  }, [])

  const updateSettings = useCallback(async (obj) => {
    setSettings(prev => {
      const next = { ...prev }
      for (const [k, v] of Object.entries(obj)) next[k] = String(v)
      return next
    })
    await settingsApi.update(obj)
  }, [])

  return { settings, loading, updateSetting, updateSettings, refetch: fetchSettings }
}
