import { Pencil, Trash2, CheckCircle2, Clock } from 'lucide-react'
import { getDaysLeftInTz, getTzAbbr } from '../lib/timezone.js'

const CATEGORY_EMOJI = {
  Dairy: '🥛', Vegetable: '🥦', Fruit: '🍎', Meat: '🥩',
  Snack: '🍪', Beverage: '🧃', Other: '📦',
}

const STATUS_LABELS = {
  fresh: 'Fresh', soon: 'Use Soon', today: 'Expiring Today',
  expired: 'Expired', used: 'Used',
}

export default function ItemCard({ item, onEdit, onDelete, onConsume, timezone }) {
  const tz       = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  const daysLeft = getDaysLeftInTz(item.expiry_date, tz)
  const tzAbbr   = getTzAbbr(tz)

  const daysLabel =
    daysLeft < 0  ? `Expired ${Math.abs(daysLeft)}d ago`
    : daysLeft === 0 ? 'Expires today!'
    : `${daysLeft}d left`

  const statusClass = `status-${item.status}`

  return (
    <div className="card fade-in flex flex-col hover:shadow-md transition-shadow">
      {/* ── Top: name + badge ── */}
      <div className="p-3 sm:p-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl sm:text-2xl flex-shrink-0">
            {CATEGORY_EMOJI[item.category] || '📦'}
          </span>
          <div className="min-w-0">
            <p
              className="font-semibold text-sm leading-tight truncate"
              style={{ color: 'var(--text)' }}
            >
              {item.name}
            </p>
            {item.quantity && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{item.quantity}</p>
            )}
          </div>
        </div>
        <span className={`status-badge ${statusClass} flex-shrink-0`}>
          {STATUS_LABELS[item.status] || item.status}
        </span>
      </div>

      {/* ── Middle: expiry info with timezone ── */}
      <div
        className="px-3 sm:px-4 pb-2 flex items-center gap-1 text-xs"
        style={{ color: 'var(--muted)' }}
      >
        <Clock size={11} />
        <span>{daysLabel}</span>
        <span className="opacity-50">·</span>
        <span
          className="font-medium px-1 py-0.5 rounded text-xs"
          style={{ background: 'var(--border)', color: 'var(--muted)', fontSize: '0.65rem' }}
          title={tz}
        >
          {tzAbbr}
        </span>
        <span className="opacity-50">·</span>
        <span>{item.category}</span>
      </div>

      {/* ── Actions: always visible, 44px touch targets ── */}
      <div
        className="flex border-t mt-auto"
        style={{ borderColor: 'var(--border)' }}
      >
        <button
          onClick={() => onConsume(item)}
          title="Mark as used"
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold
                     transition-colors active:scale-95"
          style={{
            minHeight: 44,
            color: '#15803D',
            background: 'transparent',
            borderRight: `1px solid var(--border)`,
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#DCFCE7'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <CheckCircle2 size={14} /> Used
        </button>

        <button
          onClick={() => onEdit(item)}
          title="Edit"
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium
                     transition-colors active:scale-95"
          style={{
            minHeight: 44,
            color: 'var(--text)',
            background: 'transparent',
            borderRight: `1px solid var(--border)`,
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Pencil size={13} /> Edit
        </button>

        <button
          onClick={() => onDelete(item)}
          title="Delete"
          className="flex items-center justify-center transition-colors active:scale-95"
          style={{
            minHeight: 44,
            width: 44,
            color: 'var(--red)',
            background: 'transparent',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#FEE2E2'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
