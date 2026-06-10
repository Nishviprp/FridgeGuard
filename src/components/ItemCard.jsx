import { Pencil, Trash2, CheckCircle2, Clock } from 'lucide-react'
import { differenceInCalendarDays } from 'date-fns'

const CATEGORY_EMOJI = {
  Dairy: '🥛', Vegetable: '🥦', Fruit: '🍎', Meat: '🥩',
  Snack: '🍪', Beverage: '🧃', Other: '📦',
}

const STATUS_LABELS = {
  fresh: 'Fresh', soon: 'Use Soon', today: 'Expiring Today', expired: 'Expired', used: 'Used',
}

export function getDaysLeft(expiryDate) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const exp = new Date(expiryDate); exp.setHours(0, 0, 0, 0)
  return differenceInCalendarDays(exp, today)
}

export default function ItemCard({ item, onEdit, onDelete, onConsume }) {
  const daysLeft = getDaysLeft(item.expiry_date)
  const statusClass = `status-${item.status}`

  const daysLabel =
    daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago`
    : daysLeft === 0 ? 'Expires today!'
    : `${daysLeft}d left`

  return (
    <div className="card fade-in p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl flex-shrink-0">
            {CATEGORY_EMOJI[item.category] || '📦'}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate" style={{ color: 'var(--text)' }}>
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

      <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
        <Clock size={12} />
        <span>{daysLabel}</span>
        <span className="mx-1">·</span>
        <span>{item.category}</span>
      </div>

      <div className="flex gap-2 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => onConsume(item)}
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors"
          style={{ color: '#15803D', background: '#DCFCE7' }}
          title="Mark as used"
        >
          <CheckCircle2 size={13} /> Used
        </button>
        <button
          onClick={() => onEdit(item)}
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg btn-ghost"
          title="Edit"
        >
          <Pencil size={13} /> Edit
        </button>
        <button
          onClick={() => onDelete(item)}
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg ml-auto"
          style={{ color: 'var(--red)' }}
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
