import { useState, useRef, useEffect } from 'react'
import { Bell, X, CheckCheck, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function NotificationBell({ notifications, unreadCount, onMarkAllRead, onClear }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const formatTime = str => {
    try { return format(parseISO(str), 'MMM d, h:mm a') } catch { return str }
  }

  const handleOpen = () => {
    const wasOpen = open
    setOpen(v => !v)
    if (!wasOpen && unreadCount > 0) onMarkAllRead()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative btn-ghost"
        style={{ padding: '8px' }}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold"
            style={{ background: 'var(--red)', fontSize: '0.65rem' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-12 card slide-down z-50 overflow-hidden"
          style={{ width: 320, maxHeight: 420, display: 'flex', flexDirection: 'column' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <span className="font-semibold text-sm">Notifications</span>
            <div className="flex gap-2" style={{ color: 'var(--muted)' }}>
              <button onClick={onMarkAllRead} title="Mark all read"><CheckCheck size={15} /></button>
              <button onClick={onClear} title="Clear all"><Trash2 size={15} /></button>
              <button onClick={() => setOpen(false)}><X size={15} /></button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
                <Bell size={28} className="mx-auto mb-2 opacity-30" />
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className="px-4 py-3 border-b flex gap-3"
                  style={{
                    borderColor: 'var(--border)',
                    background: !n.read ? 'rgba(124,174,122,0.07)' : 'transparent',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug" style={{ color: 'var(--text)' }}>{n.message}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{formatTime(n.sent_at)}</p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: 'var(--sage)' }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
