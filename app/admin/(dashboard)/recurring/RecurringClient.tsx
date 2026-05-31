'use client'

import { useState } from 'react'

const PAUSED_DATE = '2099-01-01'

const RECURRING_INTERVALS = [
  { value: 'weekly',        label: 'Weekly'        },
  { value: 'biweekly',      label: 'Every 2 Weeks' },
  { value: 'monthly',       label: 'Monthly'       },
  { value: 'every_6_weeks', label: 'Every 6 Weeks' },
  { value: 'every_8_weeks', label: 'Every 8 Weeks' },
] as const

// ── Types (local, from joined query) ─────────────────────────────────────────

interface OrderItem {
  id: number
  quantity: number
  unit_price_cents: number
  product_variants: {
    id: number
    size: string
    sku: string
    products: { id: number; name: string }
  }
}

interface RecurringOrder {
  id: number
  status: string
  total_amount_cents: number
  notes: string | null
  is_recurring: boolean
  recurring_interval: string | null
  scheduled_for: string | null
  created_at: string
  partners: {
    id: string
    company_name: string
    email: string
    contact_person: string
    phone: string | null
  } | null
  order_items: OrderItem[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function isPaused(order: RecurringOrder) {
  return order.scheduled_for === PAUSED_DATE
}

function sectionOf(order: RecurringOrder): 'ready' | 'upcoming' | 'paused' {
  if (isPaused(order)) return 'paused'
  if (!order.scheduled_for || order.scheduled_for <= todayISO()) return 'ready'
  return 'upcoming'
}

function intervalLabel(val: string | null) {
  return RECURRING_INTERVALS.find(i => i.value === val)?.label ?? val ?? '—'
}

async function apiFetch(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error ?? 'Request failed')
  }
  return res.json()
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#777' }}>
        {title}
      </h2>
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">
        {count}
      </span>
    </div>
  )
}

// ── Order card ────────────────────────────────────────────────────────────────

interface CardProps {
  order:       RecurringOrder
  onUpdate:    (updated: RecurringOrder) => void
  onCancel:    (id: number) => void
}

function OrderCard({ order, onUpdate, onCancel }: CardProps) {
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Edit state
  const [editNotes, setEditNotes]           = useState(order.notes ?? '')
  const [editQtys, setEditQtys]             = useState<Record<number, number>>(
    Object.fromEntries(order.order_items.map(i => [i.id, i.quantity]))
  )
  const [editDate, setEditDate]             = useState(
    !order.scheduled_for || order.scheduled_for === PAUSED_DATE ? todayISO() : order.scheduled_for
  )
  const [editInterval, setEditInterval]     = useState(order.recurring_interval ?? 'biweekly')
  const [resumeDate, setResumeDate]         = useState(todayISO())
  const [showResume, setShowResume]         = useState(false)

  const paused = isPaused(order)
  const p      = order.partners

  function startEdit() {
    setEditNotes(order.notes ?? '')
    setEditQtys(Object.fromEntries(order.order_items.map(i => [i.id, i.quantity])))
    setEditDate(!order.scheduled_for || order.scheduled_for === PAUSED_DATE ? todayISO() : order.scheduled_for)
    setEditInterval(order.recurring_interval ?? 'biweekly')
    setError(null)
    setEditing(true)
  }

  async function saveEdit() {
    setSaving(true); setError(null)
    try {
      const items = Object.entries(editQtys).map(([id, quantity]) => ({
        id: Number(id), quantity,
      }))
      const updated: RecurringOrder = await apiFetch(`/api/orders/${order.id}`, 'PATCH', {
        notes:              editNotes,
        scheduled_for:      editDate,
        recurring_interval: editInterval,
        items,
      })
      onUpdate(updated)
      setEditing(false)
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  async function handlePause() {
    setSaving(true); setError(null)
    try {
      const updated: RecurringOrder = await apiFetch(`/api/orders/${order.id}`, 'PATCH', { action: 'pause' })
      onUpdate(updated)
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  async function handleResume() {
    setSaving(true); setError(null)
    try {
      const updated: RecurringOrder = await apiFetch(`/api/orders/${order.id}`, 'PATCH', {
        action: 'resume', scheduled_for: resumeDate,
      })
      onUpdate(updated)
      setShowResume(false)
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 flex items-start justify-between gap-4 border-b border-stone-100">
        <div>
          <p className="font-semibold text-stone-800">
            {p?.company_name ?? 'Unknown partner'}
            <span className="ml-2 font-normal text-stone-400 text-sm">#{order.id}</span>
          </p>
          <p className="text-xs text-stone-400 mt-0.5">
            {p?.contact_person}{p?.email ? ` · ${p.email}` : ''}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="font-semibold text-stone-700">{fmtPrice(order.total_amount_cents)}</p>
          <p className="text-xs text-stone-400 mt-0.5">
            {intervalLabel(order.recurring_interval)}
            {order.scheduled_for && !paused
              ? ` · starts ${fmtDate(order.scheduled_for)}`
              : paused ? ' · paused' : ''}
          </p>
        </div>
      </div>

      {/* Body */}
      {editing ? (
        <div className="px-5 py-4 space-y-4 bg-stone-50">
          {/* Item quantities */}
          <div>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Items</p>
            <div className="space-y-2">
              {order.order_items.map(item => {
                const qty  = editQtys[item.id] ?? item.quantity
                const name = item.product_variants?.products?.name ?? 'Product'
                const size = item.product_variants?.size ?? ''
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-stone-600">
                      {name} <span className="text-stone-400 text-xs">{size}</span>
                    </span>
                    <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setEditQtys(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] ?? item.quantity) - 1) }))}
                        className="px-2.5 py-1 text-sm text-amber-700 hover:bg-stone-100"
                      >−</button>
                      <span className="px-3 py-1 text-sm font-medium min-w-[3.5rem] text-center"
                            style={{ color: qty === 0 ? '#dc2626' : '#1c1c1c' }}>
                        {qty === 0 ? 'Remove' : qty}
                      </span>
                      <button
                        onClick={() => setEditQtys(p => ({ ...p, [item.id]: (p[item.id] ?? item.quantity) + 1 }))}
                        className="px-2.5 py-1 text-sm text-amber-700 hover:bg-stone-100"
                      >+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">First/next shipment</label>
              <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                     className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Frequency</label>
              <select value={editInterval} onChange={e => setEditInterval(e.target.value)}
                      className={inputCls}>
                {RECURRING_INTERVALS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Notes</label>
            <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                      rows={2} className={inputCls + ' resize-none'} />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button onClick={saveEdit} disabled={saving}
                    className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button onClick={() => setEditing(false)}
                    className="border border-stone-300 px-4 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-50">
              Cancel
            </button>
          </div>
        </div>
      ) : showResume ? (
        <div className="px-5 py-4 space-y-3 bg-stone-50">
          <p className="text-sm font-medium text-stone-700">Resume — set next shipment date:</p>
          <input type="date" value={resumeDate} min={todayISO()}
                 onChange={e => setResumeDate(e.target.value)} className={inputCls} />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleResume} disabled={saving}
                    className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm">
              {saving ? 'Saving…' : 'Resume Order'}
            </button>
            <button onClick={() => setShowResume(false)}
                    className="border border-stone-300 px-4 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Items */}
          <div className="px-5 py-3 space-y-1.5">
            {order.order_items.map(item => (
              <div key={item.id} className="flex justify-between text-sm text-stone-600">
                <span>
                  <span className="font-medium">{item.quantity}×</span>{' '}
                  {item.product_variants?.products?.name}{' '}
                  <span className="text-stone-400 text-xs">{item.product_variants?.size}</span>
                </span>
                <span className="text-stone-500">{fmtPrice(item.unit_price_cents * item.quantity)}</span>
              </div>
            ))}
            {order.notes && (
              <p className="text-xs italic text-amber-700 pt-1">Note: {order.notes}</p>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 py-3 flex flex-wrap gap-2 border-t border-stone-100">
            <button onClick={startEdit} disabled={saving}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-50">
              Edit
            </button>

            {paused ? (
              <button onClick={() => { setShowResume(true); setResumeDate(todayISO()) }} disabled={saving}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50">
                Resume
              </button>
            ) : (
              <button onClick={handlePause} disabled={saving}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-yellow-300 text-yellow-800 hover:bg-yellow-50 disabled:opacity-50">
                {saving ? 'Pausing…' : 'Pause'}
              </button>
            )}

            <button onClick={() => onCancel(order.id)} disabled={saving}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">
              Cancel Order
            </button>
          </div>

          {error && (
            <div className="px-5 pb-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function RecurringClient({ initialOrders }: { initialOrders: RecurringOrder[] }) {
  const [orders, setOrders] = useState<RecurringOrder[]>(initialOrders)
  const [cancelError, setCancelError] = useState<string | null>(null)

  function updateOrder(updated: RecurringOrder) {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
  }

  async function cancelOrder(orderId: number) {
    if (!confirm('Cancel this recurring order? The customer will need to place a new one.')) return
    setCancelError(null)
    try {
      await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: [orderId] }),
      })
      setOrders(prev => prev.filter(o => o.id !== orderId))
    } catch (e) {
      setCancelError((e as Error).message)
    }
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-stone-200 p-12 text-center">
        <p className="text-stone-400 text-sm">No recurring orders yet.</p>
      </div>
    )
  }

  const ready    = orders.filter(o => sectionOf(o) === 'ready')
  const upcoming = orders.filter(o => sectionOf(o) === 'upcoming')
  const paused   = orders.filter(o => sectionOf(o) === 'paused')

  return (
    <div className="space-y-8">
      {cancelError && (
        <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          <p className="text-sm text-red-600">{cancelError}</p>
        </div>
      )}

      {ready.length > 0 && (
        <div>
          <SectionHeader title="Ready to Process" count={ready.length} />
          <div className="space-y-3">
            {ready.map(o => (
              <OrderCard key={o.id} order={o} onUpdate={updateOrder} onCancel={cancelOrder} />
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <SectionHeader title="Upcoming" count={upcoming.length} />
          <div className="space-y-3">
            {upcoming.map(o => (
              <OrderCard key={o.id} order={o} onUpdate={updateOrder} onCancel={cancelOrder} />
            ))}
          </div>
        </div>
      )}

      {paused.length > 0 && (
        <div>
          <SectionHeader title="Paused" count={paused.length} />
          <div className="space-y-3">
            {paused.map(o => (
              <OrderCard key={o.id} order={o} onUpdate={updateOrder} onCancel={cancelOrder} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
