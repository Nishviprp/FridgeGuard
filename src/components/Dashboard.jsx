import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, ScanLine, Download, RefreshCw } from 'lucide-react'
import { itemsApi } from '../lib/api.js'
import ItemCard from './ItemCard.jsx'
import AddItemModal from './AddItemModal.jsx'
import BillScanner from './BillScanner.jsx'
import toast from 'react-hot-toast'
import confetti from 'canvas-confetti'

const CATEGORIES = ['All','Dairy','Vegetable','Fruit','Meat','Snack','Beverage','Other']
const STATUSES = [
  { key: 'all',     label: 'All'             },
  { key: 'fresh',   label: '🟢 Fresh'        },
  { key: 'soon',    label: '🟡 Use Soon'     },
  { key: 'today',   label: '🔴 Today'        },
  { key: 'expired', label: '💀 Expired'      },
]

export default function Dashboard({ session, onStatsChange, timezone }) {
  const [items, setItems]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [catFilter, setCatFilter]       = useState('All')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showScanner, setShowScanner]   = useState(false)
  const [editItem, setEditItem]         = useState(null)

  const fetchItems = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const data = await itemsApi.getAll({
        ...(catFilter !== 'All' && { category: catFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(search && { search }),
      })
      setItems(data)
    } catch (e) {
      toast.error('Failed to load items')
    } finally {
      setLoading(false)
    }
  }, [session, catFilter, statusFilter, search])

  useEffect(() => {
    const t = setTimeout(fetchItems, 200)
    return () => clearTimeout(t)
  }, [fetchItems])

  // Keyboard shortcuts: N = new item, F = focus search
  useEffect(() => {
    const handler = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'n' || e.key === 'N') { setEditItem(null); setShowAddModal(true) }
      if (e.key === 'f' || e.key === 'F') document.getElementById('search-input')?.focus()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSave = async form => {
    try {
      if (editItem) {
        await itemsApi.update(editItem.id, form)
        toast.success('Item updated ✏️')
      } else {
        await itemsApi.create(form)
        toast.success('Item added to fridge! 🎉')
      }
      setShowAddModal(false)
      setEditItem(null)
      fetchItems()
      onStatsChange?.()
    } catch (e) {
      toast.error(e.message || 'Failed to save item')
    }
  }

  const handleConsume = async item => {
    try {
      await itemsApi.consume(item.id)
      toast.success(`✅ ${item.name} used before expiry!`)
      confetti({
        particleCount: 80, spread: 60,
        origin: { y: 0.6 },
        colors: ['#7CAE7A','#F2A65A','#86EFAC','#FCD34D'],
      })
      fetchItems()
      onStatsChange?.()
    } catch (e) {
      toast.error('Failed to update item')
    }
  }

  const handleDelete = async item => {
    if (!confirm(`Delete "${item.name}"?`)) return
    try {
      await itemsApi.delete(item.id)
      toast.success('Item removed')
      fetchItems()
      onStatsChange?.()
    } catch (e) {
      toast.error('Failed to delete item')
    }
  }

  const handleEdit = item => { setEditItem(item); setShowAddModal(true) }

  const exportCSV = () => {
    if (!items.length) { toast.error('No items to export'); return }
    const headers = ['Name','Category','Quantity','Purchase Date','Expiry Date','Status']
    const rows = items.map(i => [i.name,i.category,i.quantity||'',i.purchase_date||'',i.expiry_date,i.status])
    const csv = [headers,...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv],{type:'text/csv'})),
      download: 'fridge-items.csv',
    })
    a.click()
    toast.success('Exported!')
  }

  const activeItems = items.filter(i => i.status !== 'expired')
  const expiredCount = items.filter(i => i.status === 'expired').length

  const FilterBtn = ({ active, onClick, label }) => (
    <button
      onClick={onClick}
      className="text-xs px-3 py-1 rounded-full border transition-colors"
      style={{
        borderColor: active ? 'var(--sage)' : 'var(--border)',
        background: active ? 'var(--sage)' : 'transparent',
        color: active ? 'white' : 'var(--text)',
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            id="search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items… (F)"
            style={{ paddingLeft: '2.2rem' }}
          />
        </div>
        {/* Action buttons — wrap on very narrow screens */}
        <div className="flex gap-2 flex-wrap">
          <button className="btn-ghost text-sm" onClick={fetchItems} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {/* Hide Export + Scan Bill text on xs, show icon only */}
          <button className="btn-ghost text-sm" onClick={exportCSV} title="Export CSV">
            <Download size={14} />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button className="btn-ghost text-sm" onClick={() => setShowScanner(true)} title="Scan grocery bill">
            <ScanLine size={14} />
            <span className="hidden sm:inline">Scan Bill</span>
          </button>
          <button
            className="btn-primary text-sm"
            onClick={() => { setEditItem(null); setShowAddModal(true) }}
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Add Item</span>
            <span className="sm:hidden">Add</span>
            <kbd className="opacity-60 text-xs ml-1 hidden sm:inline">N</kbd>
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(c => (
          <FilterBtn key={c} active={catFilter === c} onClick={() => setCatFilter(c)} label={c} />
        ))}
        <div className="w-px h-5 self-center" style={{ background: 'var(--border)' }} />
        {STATUSES.map(s => (
          <FilterBtn key={s.key} active={statusFilter === s.key} onClick={() => setStatusFilter(s.key)} label={s.label} />
        ))}
      </div>

      {/* ── Summary ── */}
      {items.length > 0 && (
        <p className="text-sm -mb-2" style={{ color: 'var(--muted)' }}>
          {activeItems.length} item{activeItems.length !== 1 ? 's' : ''} in fridge
          {expiredCount > 0 && <span style={{ color: 'var(--red)' }}> · {expiredCount} expired</span>}
        </p>
      )}

      {/* ── Items grid ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--muted)' }} />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4 fade-in">
          <span className="text-6xl">🥗</span>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            {search || catFilter !== 'All' || statusFilter !== 'all'
              ? 'No items match your filters'
              : 'Your fridge looks empty!'}
          </h3>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {search || catFilter !== 'All' || statusFilter !== 'all'
              ? 'Try adjusting search or filters'
              : 'Add some items or scan a grocery bill to get started'}
          </p>
          {!search && catFilter === 'All' && statusFilter === 'all' && (
            <div className="flex gap-3 mt-2">
              <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                <Plus size={15} /> Add Item
              </button>
              <button className="btn-ghost" onClick={() => setShowScanner(true)}>
                <ScanLine size={15} /> Scan Bill
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onConsume={handleConsume}
              timezone={timezone}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddItemModal
          onClose={() => { setShowAddModal(false); setEditItem(null) }}
          onSave={handleSave}
          editItem={editItem}
        />
      )}
      {showScanner && (
        <BillScanner
          onClose={() => setShowScanner(false)}
          onItemsAdded={() => { fetchItems(); onStatsChange?.() }}
        />
      )}
    </div>
  )
}
