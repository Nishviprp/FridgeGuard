/**
 * Thin API client — wraps fetch with auth header injection.
 * All paths are relative so they work on any domain (Vercel, localhost via `vercel dev`).
 */
import { supabase } from './supabase.js'

async function getHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request(method, path, body) {
  const headers = await getHeaders()
  const response = await fetch(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(err.error || `HTTP ${response.status}`)
  }
  return response.json()
}

export const itemsApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v && v !== 'All' && v !== 'all'))
    ).toString()
    return request('GET', `/api/items${qs ? `?${qs}` : ''}`)
  },
  get: (id) => request('GET', `/api/items/${id}`),
  create: (data) => request('POST', '/api/items', data),
  update: (id, data) => request('PUT', `/api/items/${id}`, data),
  delete: (id) => request('DELETE', `/api/items/${id}`),
  consume: (id) => request('POST', `/api/items/${id}/consume`),
}

export const statsApi = {
  get: () => request('GET', '/api/stats'),
}

export const settingsApi = {
  getAll: () => request('GET', '/api/settings'),
  update: (data) => request('PUT', '/api/settings', data),
}

export const notificationsApi = {
  getAll: () => request('GET', '/api/notifications'),
  markAllRead: () => request('PATCH', '/api/notifications', {}),
  clear: () => request('DELETE', '/api/notifications'),
}

export const parseApi = {
  parse: (text) => request('POST', '/api/parse', { text }),
}

export const pushApi = {
  getVapidKey: () => request('GET', '/api/push-subscription'),
  save: (sub) => request('POST', '/api/push-subscription', sub),
  remove: () => request('DELETE', '/api/push-subscription'),
}
