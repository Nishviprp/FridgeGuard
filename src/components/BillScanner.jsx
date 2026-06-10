import { useState } from 'react'
import { X, Sparkles, Plus, Loader2 } from 'lucide-react'
import { parseApi, itemsApi } from '../lib/api.js'
import { format, addDays } from 'date-fns'
import toast from 'react-hot-toast'

const CATEGORIES = ['Dairy', 'Vegetable', 'Fruit', 'Meat', 'Snack', 'Beverage', 'Other']
const todayStr = () => format(new Date(), 'yyyy-MM-dd')

export default function BillScanner({ onClose, onItemsAdded }) {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleParse = async () => {
    if (!text.trim()) return
    setParsing(true)
    try {
      const { items } = await parseApi.parse(text)
      const withDates = items.map(item => ({
        ...item,
        purchase_date: todayStr(),
        expiry_date: format(addDays(new Date(), item.estimatedExpiryDays || 7), 'yyyy-MM-dd'),
        avg_cost: 0,
        selected: true,
      }))
      setParsed(withDates)
    } catch (e) {
      toast.error(e.message || 'Failed to parse. Check your Anthropic API key.')
    } finally {
      setParsing(false)
    }
  }

  const toggleSelect = i =>
    setParsed(prev => prev.map((item, idx) => idx === i ? { ...item, selected: !item.selected } : item))

  const updateField = (i, key, val) =>
    setParsed(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: val } : item))

  const handleSave = async () => {
    const selected = parsed.filter(i => i.selected)
    if (!selected.length) { toast.error('Select at least one item'); return }
    setSaving(true)
    try {
      await Promise.all(selected.map(item => itemsApi.create({
        name: item.name, category: item.category, quantity: item.quantity,
        purchase_date: item.purchase_date, expiry_date: item.expiry_date, avg_cost: item.avg_cost,
      })))
      toast.success(`✅ Added ${selected.length} item(s) to your fridge!`)
      onItemsAdded?.()
      onClose()
    } catch (e) {
      toast.error('Failed to save items')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '600px' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={20} style={{ color: 'var(--sage)' }} />
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              AI Grocery Bill Scanner
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {!parsed ? (
          <>
            <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
              Paste a grocery receipt or type a list like "2kg tomatoes, 1L milk, chicken breast"
            </p>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={8}
              placeholder={"RECEIPT\n---\n1L Whole Milk          $2.49\n500g Chicken Breast    $6.99\n2x Greek Yogurt        $3.98\nCheddar Cheese 200g    $4.25"}
              style={{ fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
            />
            <div className="flex gap-3 justify-end mt-4">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleParse}
                disabled={!text.trim() || parsing}
              >
                {parsing
                  ? <><Loader2 size={15} className="animate-spin" /> Parsing…</>
                  : <><Sparkles size={15} /> Parse with AI</>
                }
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                Found {parsed.length} item(s) — review before adding
              </p>
              <button
                className="text-xs underline"
                style={{ color: 'var(--muted)' }}
                onClick={() => setParsed(null)}
              >
                Re-scan
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
              {parsed.map((item, i) => (
                <div
                  key={i}
                  className="card p-3"
                  style={{ opacity: item.selected ? 1 : 0.45, transition: 'opacity 0.15s' }}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleSelect(i)}
                      style={{ width: 16, height: 16, accentColor: 'var(--sage)', flexShrink: 0 }}
                    />
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input
                        value={item.name}
                        onChange={e => updateField(i, 'name', e.target.value)}
                        style={{ fontSize: '0.8rem' }}
                      />
                      <select
                        value={item.category}
                        onChange={e => updateField(i, 'category', e.target.value)}
                        style={{ fontSize: '0.8rem' }}
                      >
                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                      <input
                        value={item.quantity}
                        onChange={e => updateField(i, 'quantity', e.target.value)}
                        placeholder="Qty"
                        style={{ fontSize: '0.8rem' }}
                      />
                      <input
                        type="date"
                        value={item.expiry_date}
                        onChange={e => updateField(i, 'expiry_date', e.target.value)}
                        style={{ fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end mt-4">
              <button className="btn-ghost" onClick={() => setParsed(null)}>Back</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving
                  ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
                  : <><Plus size={15} /> Add {parsed.filter(i => i.selected).length} Items</>
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
