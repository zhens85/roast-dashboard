'use client'

import { useState, useMemo } from 'react'

const PAUSED_DATE   = '2099-01-01'
const WINDOW_DAYS   = 42   // 6 weeks

const INTERVAL_LABELS: Record<string, string> = {
  weekly:        'Weekly',
  biweekly:      'Every 2 Weeks',
  monthly:       'Monthly',
  every_6_weeks: 'Every 6 Weeks',
  every_8_weeks: 'Every 8 Weeks',
}

const RECURRING_INTERVALS = [
  { value: 'weekly',        label: 'Weekly'        },
  { value: 'biweekly',      label: 'Every 2 Weeks' },
  { value: 'monthly',       label: 'Monthly'       },
  { value: 'every_6_weeks', label: 'Every 6 Weeks' },
  { value: 'every_8_weeks', label: 'Every 8 Weeks' },
] as const

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Schedule projection ───────────────────────────────────────────────────────

function addInterval(date: Date, interval: string | null): Date {
  const d = new Date(date)
  switch (interval) {
    case 'weekly':        d.setDate(d.getDate() + 7);   break
    case 'monthly':       d.setMonth(d.getMonth() + 1); break
    case 'every_6_weeks': d.setDate(d.getDate() + 42);  break
    case 'every_8_weeks': d.setDate(d.getDate() + 56);  break
    default:              d.setDate(d.getDate() + 14);  break // biweekly
  }
  return d
}

interface Occurrence {
  dateISO:    string
  order:      RecurringOrder
  isOverdue:  boolean
}

function buildSchedule(orders: RecurringOrder[], todayISO: string): {
  byDate: Map<string, Occurrence[]>
  paused: RecurringOrder[]
} {
  const today   = new Date(todayISO + 'T12:00:00')
  const winEnd  = new Date(today)
  winEnd.setDate(winEnd.getDate() + WINDOW_DAYS)

  const active: Occurrence[] = []
  const paused: RecurringOrder[] = []

  for (const order of orders) {
    if (order.scheduled_for === PAUSED_DATE) {
      paused.push(order)
      continue
    }

    // First occurrence: use scheduled_for if set, otherwise treat as today
    const firstDate = order.scheduled_for
      ? new Date(order.scheduled_for + 'T12:00:00')
      : new Date(today)

    let cur = new Date(firstDate)

    // Walk forward through all occurrences that fall in the window
    let iterations = 0
    while (cur <= winEnd && iterations < 100) {
      iterations++
      const dateISO  = cur.toISOString().split('T')[0]
      active.push({
        dateISO,
        order,
        isOverdue: dateISO < todayISO,
      })
      cur = addInterval(cur, order.recurring_interval)
    }
  }

  // Sort by date then by partner name
  active.sort((a, b) =>
    a.dateISO.localeCompare(b.dateISO) ||
    (a.order.partners?.company_name ?? '').localeCompare(b.order.partners?.company_name ?? '')
  )

  const byDate = new Map<string, Occurrence[]>()
  for (const occ of active) {
    if (!byDate.has(occ.dateISO)) byDate.set(occ.dateISO, [])
    byDate.get(occ.dateISO)!.push(occ)
  }

  return { byDate, paused }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDateLabel(iso: string, todayISO: string): string {
  if (iso === todayISO) return 'Today'
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
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

const inputCls = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400'

// ── Occurrence card (inline edit) ─────────────────────────────────────────────

function OccurrenceCard({
  occurrence,
  onUpdate,
  onCancel,
}: {
  occurrence: Occurrence
  onUpdate: (updated: RecurringOrder) => void
  onCancel: (id: number) => void
}) {
  const { order, isOverdue } = occurrence
  const p = order.partners

  const [editing, setEditing]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [editNotes, setEditNotes]     = useState(order.notes ?? '')
  const [editQtys, setEditQtys]       = useState<Record<number, number>>(
    Object.fromEntries(order.order_items.map(i => [i.id, i.quantity]))
  )
  const [editDate, setEditDate]       = useState(order.scheduled_for && order.scheduled_for !== PAUSED_DATE ? order.scheduled_for : todayISO())
  const [editInterval, setEditInterval] = useState(order.recurring_interval ?? 'biweekly')

  function startEdit() {
    setEditNotes(order.notes ?? '')
    setEditQtys(Object.fromEntries(order.order_items.map(i => [i.id, i.quantity])))
    setEditDate(order.scheduled_for && order.scheduled_for !== PAUSED_DATE ? order.scheduled_for : todayISO())
    setEditInterval(order.recurring_interval ?? 'biweekly')
    setError(null)
    setEditing(true)
  }

  async function saveEdit() {
    setSaving(true); setError(null)
    try {
      const items = Object.entries(editQtys).map(([id, qty]) => ({ id: Number(id), quantity: Number(qty) }))
      const updated: RecurringOrder = await apiFetch(`/api/orders/${order.id}`, 'PATCH', {
        notes: editNotes, scheduled_for: editDate, recurring_interval: editInterval, items,
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

  return (
    <div className={`bg-white rounded-lg border overflow-hidden ${isOverdue ? 'border-red-200' : 'border-stone-200'}`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-stone-800 text-sm">
              {p?.company_name ?? '—'}
            </span>
            <span className="text-xs text-stone-400">#{order.id}</span>
            {isOverdue && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-600">
                Overdue
              </span>
            )}
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            {INTERVAL_LABELS[order.recurring_interval ?? 'biweekly']}
            {' · '}first shipment: {order.scheduled_for && order.scheduled_for !== PAUSED_DATE
              ? new Date(order.scheduled_for + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : 'ASAP'}
          </p>
        </div>
        <span className="font-semibold text-stone-700 text-sm flex-shrink-0">
          {fmtPrice(order.total_amount_cents)}
        </span>
      </div>

      {editing ? (
        <div className="px-4 pb-4 space-y-3 border-t border-stone-100 pt-3 bg-stone-50">
          <p className="text-xs text-stone-500 italic">
            Changes apply to all future occurrences of this order.
          </p>

          {/* Quantities */}
          <div className="space-y-2">
            {order.order_items.map(item => {
              const qty  = editQtys[item.id] ?? item.quantity
              const name = item.product_variants?.products?.name ?? 'Product'
              const size = item.product_variants?.size ?? ''
              return (
                <div key={item.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-stone-600">
                    {name} <span className="text-stone-400 text-xs">{size}</span>
                  </span>
                  <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden">
                    <button onClick={() => setEditQtys(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] ?? item.quantity) - 1) }))}
                            className="px-2 py-1 text-sm text-amber-700 hover:bg-stone-100">−</button>
                    <span className="px-2 py-1 text-sm font-medium min-w-[3rem] text-center"
                          style={{ color: qty === 0 ? '#dc2626' : '#1c1c1c' }}>
                      {qty === 0 ? 'Del' : qty}
                    </span>
                    <button onClick={() => setEditQtys(p => ({ ...p, [item.id]: (p[item.id] ?? item.quantity) + 1 }))}
                            className="px-2 py-1 text-sm text-amber-700 hover:bg-stone-100">+</button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">First shipment</label>
              <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Frequency</label>
              <select value={editInterval} onChange={e => setEditInterval(e.target.value)} className={inputCls}>
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

          {error && <p className="text-red-600 text-xs">{error}</p>}

          <div className="flex gap-2">
            <button onClick={saveEdit} disabled={saving}
                    className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg text-xs">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)}
                    className="border border-stone-300 px-3 py-1.5 rounded-lg text-xs text-stone-600 hover:bg-stone-50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Items */}
          <div className="px-4 pb-2 space-y-1">
            {order.order_items.map(item => (
              <div key={item.id} className="flex justify-between text-xs text-stone-600">
                <span>
                  <span className="font-medium">{item.quantity}×</span>{' '}
                  {item.product_variants?.products?.name}{' '}
                  <span className="text-stone-400">{item.product_variants?.size}</span>
                </span>
                <span className="text-stone-400">{fmtPrice(item.unit_price_cents * item.quantity)}</span>
              </div>
            ))}
            {order.notes && (
              <p className="text-xs italic text-amber-700 pt-0.5">Note: {order.notes}</p>
            )}
          </div>

          {/* Actions */}
          <div className="px-4 py-2.5 flex gap-2 border-t border-stone-100">
            <button onClick={startEdit} disabled={saving}
                    className="text-xs font-medium px-2.5 py-1 rounded border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-50">
              Edit
            </button>
            <button onClick={handlePause} disabled={saving}
                    className="text-xs font-medium px-2.5 py-1 rounded border border-yellow-300 text-yellow-800 hover:bg-yellow-50 disabled:opacity-50">
              Pause
            </button>
            <button onClick={() => onCancel(order.id)} disabled={saving}
                    className="text-xs font-medium px-2.5 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Paused card (simpler — no schedule projection) ────────────────────────────

function PausedCard({
  order,
  onUpdate,
  onCancel,
}: {
  order: RecurringOrder
  onUpdate: (updated: RecurringOrder) => void
  onCancel: (id: number) => void
}) {
  const p = order.partners
  const [resumeDate, setResumeDate] = useState(todayISO())
  const [showResume, setShowResume] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

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
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div>
          <span className="font-semibold text-stone-800 text-sm">
            {p?.company_name ?? '—'}
          </span>
          <span className="ml-2 text-xs text-stone-400">#{order.id}</span>
          <p className="text-xs text-stone-400 mt-0.5">
            {INTERVAL_LABELS[order.recurring_interval ?? 'biweekly']}
          </p>
        </div>
        <span className="font-semibold text-stone-700 text-sm">{fmtPrice(order.total_amount_cents)}</span>
      </div>

      <div className="px-4 pb-2 space-y-1">
        {order.order_items.map(item => (
          <div key={item.id} className="flex justify-between text-xs text-stone-600">
            <span>
              <span className="font-medium">{item.quantity}×</span>{' '}
              {item.product_variants?.products?.name}{' '}
              <span className="text-stone-400">{item.product_variants?.size}</span>
            </span>
            <span className="text-stone-400">{fmtPrice(item.unit_price_cents * item.quantity)}</span>
          </div>
        ))}
      </div>

      {showResume ? (
        <div className="px-4 pb-3 space-y-2 border-t border-stone-100 pt-3 bg-stone-50">
          <label className="block text-xs font-medium text-stone-500">Resume — first shipment date:</label>
          <input type="date" value={resumeDate} min={todayISO()} onChange={e => setResumeDate(e.target.value)}
                 className={inputCls} />
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleResume} disabled={saving}
                    className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg text-xs">
              {saving ? 'Saving…' : 'Resume'}
            </button>
            <button onClick={() => setShowResume(false)}
                    className="border border-stone-300 px-3 py-1.5 rounded-lg text-xs text-stone-600 hover:bg-stone-50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-2.5 flex gap-2 border-t border-stone-100">
          <button onClick={() => setShowResume(true)}
                  className="text-xs font-medium px-2.5 py-1 rounded border border-green-300 text-green-700 hover:bg-green-50">
            Resume
          </button>
          <button onClick={() => onCancel(order.id)}
                  className="text-xs font-medium px-2.5 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function RecurringClient({ initialOrders }: { initialOrders: RecurringOrder[] }) {
  const [orders, setOrders]           = useState<RecurringOrder[]>(initialOrders)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const today                         = todayISO()

  const { byDate, paused } = useMemo(
    () => buildSchedule(orders, today),
    [orders, today],
  )

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
    } catch (e) { setCancelError((e as Error).message) }
  }

  const windowEndLabel = new Date(new Date(today + 'T12:00:00').getTime() + WINDOW_DAYS * 86400000)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-stone-200 p-12 text-center">
        <p className="text-stone-400 text-sm">No recurring orders yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {cancelError && (
        <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          <p className="text-sm text-red-600">{cancelError}</p>
        </div>
      )}

      {/* Schedule */}
      {byDate.size > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Schedule
            </h2>
            <span className="text-xs text-stone-400">
              Next 6 weeks · through {windowEndLabel}
            </span>
          </div>

          <div className="space-y-5">
            {Array.from(byDate.entries()).map(([dateISO, occs]) => (
              <div key={dateISO}>
                {/* Date header */}
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-sm font-bold ${dateISO <= today ? 'text-red-600' : 'text-stone-700'}`}>
                    {fmtDateLabel(dateISO, today)}
                  </span>
                  <span className="text-xs text-stone-400">
                    {new Date(dateISO + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                  <div className="flex-1 border-t border-stone-200" />
                  <span className="text-xs text-stone-400">
                    {occs.reduce((s, o) => s + o.order.order_items.reduce((ss, i) => ss + i.quantity, 0), 0)} bags
                    {' · '}
                    {fmtPrice(occs.reduce((s, o) => s + o.order.total_amount_cents, 0))}
                  </span>
                </div>

                <div className="space-y-2 pl-1">
                  {occs.map((occ, i) => (
                    <OccurrenceCard
                      key={`${dateISO}-${occ.order.id}-${i}`}
                      occurrence={occ}
                      onUpdate={updateOrder}
                      onCancel={cancelOrder}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paused */}
      {paused.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Paused</h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">
              {paused.length}
            </span>
          </div>
          <div className="space-y-3">
            {paused.map(o => (
              <PausedCard key={o.id} order={o} onUpdate={updateOrder} onCancel={cancelOrder} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
