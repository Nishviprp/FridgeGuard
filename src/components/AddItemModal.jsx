import { useState, useEffect } from 'react'
import { X, Zap } from 'lucide-react'
import { format, addDays } from 'date-fns'

const CATEGORIES = ['Dairy', 'Vegetable', 'Fruit', 'Meat', 'Snack', 'Beverage', 'Other']

const QUICK_ADD = [
  { name: 'Whole Milk',      category: 'Dairy',     quantity: '1L',     days: 7  },
  { name: 'Eggs',            category: 'Dairy',     quantity: '12 pcs', days: 21 },
  { name: 'Chicken Breast',  category: 'Meat',      quantity: '500g',   days: 3  },
  { name: 'Greek Yogurt',    category: 'Dairy',     quantity: '200g',   days: 14 },
  { name: 'Cheddar Cheese',  category: 'Dairy',     quantity: '200g',   days: 30 },
  { name: 'Spinach',         category: 'Vegetable', quantity: '100g',   days: 5  },
  { name: 'Tomatoes',        category: 'Vegetable', quantity: '4 pcs',  days: 7  },
  { name: 'Bananas',         category: 'Fruit',     quantity: '1 bunch',days: 5  },
  { name: 'Orange Juice',    category: 'Beverage',  quantity: '1L',     days: 7  },
  { name: 'Butter',          category: 'Dairy',     quantity: '250g',   days: 30 },
]

const todayStr = () => format(new Date(), 'yyyy-MM-dd')
const defaultExpiry = (days) => format(addDays(new Date(), days), 'yyyy-MM-dd')

const blank = () => ({
  name: '', category: 'Other', quantity: '',
  purchase_date: todayStr(), expiry_date: defaultExpiry(7),
  avg_cost: '', remind_days_before: 2,
})

export default function AddItemModal({ onClose, onSave, editItem }) {
  const [form, setForm] = useState(blank())

  useEffect(() => {
    if (editItem) {
      setForm({
        name: editItem.name || '',
        category: editItem.category || 'Other',
        quantity: editItem.quantity || '',
        purchase_date: editItem.purchase_date || todayStr(),
        expiry_date: editItem.expiry_date || defaultExpiry(7),
        avg_cost: editItem.avg_cost ?? '',
        remind_days_before: 2,
      })
    }
  }, [editItem])

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  const applyQuickAdd = item => setForm(f => ({
    ...f,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    expiry_date: defaultExpiry(item.days),
  }))

  const handleSubmit = e => {
    e.preventDefault()
    if (!form.name || !form.expiry_date) return
    onSave({ ...form, avg_cost: parseFloat(form.avg_cost) || 0 })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
            {editItem ? 'Edit Item' : 'Add Food Item'}
          </h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {!editItem && (
          <div className="mb-4">
            <p className="form-label mb-2">Quick Add</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_ADD.map(item => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => applyQuickAdd(item)}
                  className="text-xs px-2 py-1 rounded-full border transition-colors"
                  style={{ borderColor: 'var(--sage)', color: 'var(--sage)' }}
                >
                  <Zap size={10} className="inline mr-1" />
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="form-label">Item Name *</label>
              <input
                value={form.name}
                onChange={set('name')}
                placeholder="e.g. Whole Milk"
                required
              />
            </div>
            <div>
              <label className="form-label">Category</label>
              <select value={form.category} onChange={set('category')}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Quantity</label>
              <input value={form.quantity} onChange={set('quantity')} placeholder="e.g. 1L, 500g" />
            </div>
            <div>
              <label className="form-label">Purchase Date</label>
              <input type="date" value={form.purchase_date} onChange={set('purchase_date')} />
            </div>
            <div>
              <label className="form-label">Expiry Date *</label>
              <input type="date" value={form.expiry_date} onChange={set('expiry_date')} required />
            </div>
            <div>
              <label className="form-label">Avg Cost ($)</label>
              <input type="number" step="0.01" value={form.avg_cost} onChange={set('avg_cost')} placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">Remind (days before)</label>
              <input
                type="number" min="0" max="30"
                value={form.remind_days_before}
                onChange={set('remind_days_before')}
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">
              {editItem ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
