import { useState, useRef, useEffect } from 'react'
import { Bell, X, CheckCheck, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function NotificationBell({ notifications, unreadCount, onMarkAllRead, onClear }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // On mobile, also prevent body scroll when open
  useEffect(() => {
    if (open && window.innerWidth < 640) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

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
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 text-white rounded-full flex items-center justify-center font-bold"
            style={{
              background: 'var(--red)',
              fontSize: '0.6rem',
              width: 18, height: 18,
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-40 sm:hidden"
            style={{ background: 'rgba(0,0,0,0.35)' }}
            onClick={() => setOpen(false)}
          />

          {/* Panel — uses .notif-panel (CSS handles desktop vs mobile) */}
          <div
            className="notif-panel card slide-down z-50 overflow-hidden flex flex-col"
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="font-semibold text-sm">Notifications</span>
              <div className="flex gap-3" style={{ color: 'var(--muted)' }}>
                <button
                  onClick={onMarkAllRead}
                  title="Mark all read"
                  className="p-1"
                  style={{ minWidth: 28, minHeight: 28 }}
                >
                  <CheckCheck size={15} />
                </button>
                <button
                  onClick={onClear}
                  title="Clear all"
                  className="p-1"
                  style={{ minWidth: 28, minHeight: 28 }}
                >
                  <Trash2 size={15} />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1"
                  style={{ minWidth: 28, minHeight: 28 }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
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
                      <p className="text-sm leading-snug" style={{ color: 'var(--text)' }}>
                        {n.message}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        {formatTime(n.sent_at)}
                      </p>
                    </div>
                    {!n.read && (
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: 'var(--sage)' }}
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
