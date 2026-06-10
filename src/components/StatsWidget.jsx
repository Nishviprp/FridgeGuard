import { useState, useEffect } from 'react'
import { TrendingUp, Trash2, Package, AlertTriangle } from 'lucide-react'
import { statsApi } from '../lib/api.js'

export default function StatsWidget({ refreshKey, session }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!session) return
    statsApi.get().then(setStats).catch(() => {})
  }, [refreshKey, session])

  if (!stats) return null

  const saved = Number(stats.consumed?.value || 0).toFixed(2)
  const wasted = Number(stats.expired?.value || 0).toFixed(2)

  const cards = [
    { icon: <Package size={20} />,     label: 'In Fridge',        value: stats.active,               color: 'var(--sage)'  },
    { icon: <TrendingUp size={20} />,  label: 'Used This Week',   value: stats.consumed?.count || 0, color: '#15803D', sub: `$${saved} saved`  },
    { icon: <Trash2 size={20} />,      label: 'Wasted This Week', value: stats.expired?.count || 0,  color: 'var(--red)',  sub: `$${wasted} lost`  },
    { icon: <AlertTriangle size={20}/>,label: 'Expiring Soon',    value: stats.expiringSoon || 0,    color: 'var(--amber)' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span style={{ color: c.color }}>{c.icon}</span>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              {c.label}
            </span>
          </div>
          <p className="text-3xl font-bold" style={{ color: c.color }}>{c.value}</p>
          {c.sub && <p className="text-xs" style={{ color: 'var(--muted)' }}>{c.sub}</p>}
        </div>
      ))}
    </div>
  )
}
