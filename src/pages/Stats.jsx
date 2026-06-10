import { useState, useEffect } from 'react'
import { TrendingUp, Trash2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'
import { statsApi } from '../lib/api.js'

export default function Stats({ session }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    statsApi.get()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

  if (loading) return (
    <div className="flex justify-center py-20">
      <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--muted)' }} />
    </div>
  )
  if (!stats) return null

  const savedMoney = Number(stats.consumed?.value || 0).toFixed(2)
  const wastedMoney = Number(stats.expired?.value || 0).toFixed(2)
  const totalHandled = (stats.consumed?.count || 0) + (stats.expired?.count || 0)
  const wasteRate = totalHandled > 0 ? Math.round((stats.expired.count / totalHandled) * 100) : 0
  const successRate = 100 - wasteRate

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>This Week's Stats</h2>

      <div className="grid grid-cols-2 gap-4">
        {[
          { icon: <CheckCircle2 size={20}/>, label: 'Items Consumed', value: stats.consumed?.count||0, color:'#15803D', sub:`~$${savedMoney} saved` },
          { icon: <Trash2 size={20}/>,       label: 'Items Wasted',   value: stats.expired?.count||0,  color:'var(--red)',  sub:`~$${wastedMoney} lost` },
          { icon: <TrendingUp size={20}/>,   label: 'Success Rate',   value: `${successRate}%`,         color:'var(--sage)', sub:'Used before expiry' },
          { icon: <AlertTriangle size={20}/>,label: 'Active Items',   value: stats.active||0,           color:'var(--amber)', sub:'Currently in fridge' },
        ].map(c => (
          <div key={c.label} className="card p-5">
            <div className="flex items-center gap-2 mb-3" style={{ color: c.color }}>
              {c.icon}
              <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{c.label}</span>
            </div>
            <p className="text-4xl font-bold" style={{ color: c.color }}>{c.value}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {totalHandled > 0 && (
        <div className="card p-5">
          <p className="font-semibold mb-3 text-sm" style={{ color: 'var(--text)' }}>Food Efficiency</p>
          <div className="flex rounded-full overflow-hidden h-5" style={{ background: 'var(--border)' }}>
            <div
              className="h-full flex items-center justify-center text-white text-xs font-bold transition-all"
              style={{ width: `${successRate}%`, background: 'var(--sage)', minWidth: successRate > 0 ? 32 : 0 }}
            >
              {successRate > 10 ? `${successRate}%` : ''}
            </div>
            <div
              className="h-full flex items-center justify-center text-white text-xs font-bold"
              style={{ width: `${wasteRate}%`, background: 'var(--red)', minWidth: wasteRate > 0 ? 32 : 0 }}
            >
              {wasteRate > 10 ? `${wasteRate}%` : ''}
            </div>
          </div>
          <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--muted)' }}>
            <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1" style={{background:'var(--sage)'}}/>Used</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1" style={{background:'var(--red)'}}/>Wasted</span>
          </div>
        </div>
      )}

      {totalHandled === 0 && (
        <div className="card p-8 text-center">
          <span className="text-4xl">📊</span>
          <p className="mt-3 font-semibold" style={{ color: 'var(--text)' }}>No activity this week yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Mark items as used to start tracking your food efficiency
          </p>
        </div>
      )}
    </div>
  )
}
