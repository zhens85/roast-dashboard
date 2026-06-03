'use client'

import { useState, useMemo } from 'react'
import type { PortalOrder } from '@/types'

const PAUSED_DATE   = '2099-01-01'
const WINDOW_DAYS   = 42   // 6 weeks

const RECURRING_LABELS: Record<string, string> = {
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

type RecurringInterval = typeof RECURRING_INTERVALS[number]['value']

// ── Schedule projection ───────────────────────────────────────────────────────

function addInterval(date: Date, interval: string | null): Date {
  const d = new Date(date)
  switch (interval) {
    case 'weekly':        d.setDate(d.getDate() + 7);   break
    case 'monthly':       d.setMonth(d.getMonth() + 1); break
    case 'every_6_weeks': d.setDate(d.getDate() + 42);  break
    case 'every_8_weeks': d.setDate(d.getDate() + 56);  break
    default:              d.setDate(d.getDate() + 14);  break
  }
  return d
}

function buildSchedule(
  orders: PortalOrder[],
  todayISO: string,
): Map<string, PortalOrder[]> {
  const today  = new Date(todayISO + 'T12:00:00')
  const winEnd = new Date(today)
  winEnd.setDate(winEnd.getDate() + WINDOW_DAYS)

  type Occ = { dateISO: string; order: PortalOrder }
  const occurrences: Occ[] = []

  for (const order of orders) {
    if (!order.is_recurring) continue
    if (order.scheduled_for === PAUSED_DATE) continue
    if (order.status !== 'pending') continue

    const firstDate = order.scheduled_for
      ? new Date(order.scheduled_for + 'T12:00:00')
      : new Date(today)

    let cur = new Date(firstDate)
    let iters = 0

    while (cur <= winEnd && iters < 100) {
      iters++
      occurrences.push({ dateISO: cur.toISOString().split('T')[0], order })
      cur = addInterval(cur, order.recurring_interval)
    }
  }

  occurrences.sort((a, b) => a.dateISO.localeCompare(b.dateISO))

  const byDate = new Map<string, PortalOrder[]>()
  for (const { dateISO, order } of occurrences) {
    if (!byDate.has(dateISO)) byDate.set(dateISO, [])
    byDate.get(dateISO)!.push(order)
  }

  return byDate
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtDateLabel(iso: string, todayISO: string): string {
  if (iso === todayISO) return 'Today'
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function displayState(order: PortalOrder): string {
  if (order.status !== 'pending') return order.status
  if (order.scheduled_for === PAUSED_DATE) return 'paused'
  if (order.scheduled_for && order.scheduled_for > todayISO()) return 'scheduled'
  return 'pending'
}

const CHIP: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#fef3cd', color: '#7a5c00'  },
  scheduled: { bg: '#e0f2fe', color: '#0369a1'  },
  paused:    { bg: '#f3f4f6', color: '#6b7280'  },
  confirmed: { bg: '#dbeafe', color: '#1e4d91'  },
  shipped:   { bg: '#ede9fe', color: '#5b21b6'  },
  delivered: { bg: '#d1fae5', color: '#065f46'  },
  cancelled: { bg: '#f3f4f6', color: '#6b7280'  },
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
  return method === 'DELETE' ? null : res.json()
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OrdersClient({ initialOrders }: { initialOrders: PortalOrder[] }) {
  const [orders, setOrders]         = useState<PortalOrder[]>(initialOrders)
  const [editingId, setEditingId]   = useState<number | null>(null)
  const [editNotes, setEditNotes]   = useState('')
  const [editQtys, setEditQtys]     = useState<Record<number, number>>({})
  const [datePanelId, setDatePanel] = useState<number | null>(null)
  const [dateAction, setDateAction] = useState<'reschedule' | 'resume'>('reschedule')
  const [newDate, setNewDate]       = useState(todayISO())
  const [saving, setSaving]         = useState<number | null>(null)
  const [error, setError]           = useState<string | null>(null)

  const today = todayISO()

  const scheduleByDate = useMemo(() => buildSchedule(orders, today), [orders, today])

  const windowEndLabel = useMemo(() => {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() + WINDOW_DAYS)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }, [today])

  function updateOrder(updated: PortalOrder) {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
  }

  function startEdit(order: PortalOrder) {
    setEditingId(order.id)
    setEditNotes(order.notes ?? '')
    setEditQtys(Object.fromEntries(order.order_items.map(i => [i.id, i.quantity])))
    setDatePanel(null)
    setError(null)
  }

  function openDatePanel(order: PortalOrder, action: 'reschedule' | 'resume') {
    setDatePanel(order.id)
    setDateAction(action)
    setNewDate(
      action === 'resume'
        ? todayISO()
        : order.scheduled_for && order.scheduled_for !== PAUSED_DATE
          ? order.scheduled_for
          : todayISO()
    )
    setEditingId(null)
    setError(null)
  }

  async function saveEdit(orderId: number) {
    setSaving(orderId); setError(null)
    try {
      const items = Object.entries(editQtys).map(([id, quantity]) => ({
        id: Number(id), quantity,
      }))
      const updated: PortalOrder = await apiFetch(
        `/api/portal/orders/${orderId}`, 'PATCH',
        { action: 'edit', notes: editNotes, items },
      )
      updateOrder(updated)
      setEditingId(null)
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(null) }
  }

  async function pauseOrder(orderId: number) {
    setSaving(orderId); setError(null)
    try {
      const updated: PortalOrder = await apiFetch(
        `/api/portal/orders/${orderId}`, 'PATCH', { action: 'pause' },
      )
      updateOrder(updated)
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(null) }
  }

  async function submitDateAction(orderId: number) {
    setSaving(orderId); setError(null)
    try {
      const updated: PortalOrder = await apiFetch(
        `/api/portal/orders/${orderId}`, 'PATCH',
        { action: dateAction, scheduled_for: newDate },
      )
      updateOrder(updated)
      setDatePanel(null)
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(null) }
  }

  async function deleteOrder(orderId: number) {
    if (!confirm('Delete this order? This cannot be undone.')) return
    setSaving(orderId); setError(null)
    try {
      await apiFetch(`/api/portal/orders/${orderId}`, 'DELETE')
      setOrders(prev => prev.filter(o => o.id !== orderId))
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(null) }
  }

  // ── Shared order card body (used in both schedule and history) ──────────────

  function OrderCardBody({ order }: { order: PortalOrder }) {
    const canManage = order.status === 'pending' || order.status === 'confirmed'
    const paused    = order.scheduled_for === PAUSED_DATE
    const isEditing = editingId === order.id
    const isDate    = datePanelId === order.id
    const busy      = saving === order.id

    if (isEditing) return (
      <div className="px-5 py-4 space-y-4 bg-stone-50">
        <div className="space-y-3">
          {order.order_items.map(item => {
            const qty  = editQtys[item.id] ?? item.quantity
            const name = item.product_variants?.products?.name ?? 'Product'
            const size = item.product_variants?.size ?? ''
            return (
              <div key={item.id} className="flex items-center gap-3">
                <span className="flex-1 text-sm" style={{ color: '#555' }}>
                  {name} <span className="text-xs" style={{ color: '#999' }}>{size}</span>
                </span>
                <div className="flex items-center border rounded-lg overflow-hidden" style={{ borderColor: '#d0d0d0' }}>
                  <button onClick={() => setEditQtys(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] ?? item.quantity) - 1) }))}
                          className="px-2.5 py-1.5 hover:bg-gray-50 text-sm font-medium" style={{ color: '#466c7e' }}>−</button>
                  <span className="px-3 py-1.5 text-sm font-medium min-w-[3.5rem] text-center"
                        style={{ color: (editQtys[item.id] ?? item.quantity) === 0 ? '#dc2626' : '#3b4858' }}>
                    {(editQtys[item.id] ?? item.quantity) === 0 ? 'Remove' : (editQtys[item.id] ?? item.quantity)}
                  </span>
                  <button onClick={() => setEditQtys(p => ({ ...p, [item.id]: (p[item.id] ?? item.quantity) + 1 }))}
                          className="px-2.5 py-1.5 hover:bg-gray-50 text-sm font-medium" style={{ color: '#466c7e' }}>+</button>
                </div>
              </div>
            )
          })}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#888' }}>Notes</label>
          <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
                    style={{ borderColor: '#d0d0d0', color: '#3b4858' }} />
        </div>
        {error && <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => saveEdit(order.id)} disabled={busy}
                  className="text-sm font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#466c7e' }}>
            {busy ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={() => setEditingId(null)}
                  className="text-sm px-4 py-2 rounded-lg border hover:bg-gray-50"
                  style={{ borderColor: '#d0d0d0', color: '#666' }}>
            Cancel
          </button>
        </div>
      </div>
    )

    if (isDate) return (
      <div className="px-5 py-4 space-y-3 bg-stone-50">
        <p className="text-sm font-medium" style={{ color: '#3b4858' }}>
          {dateAction === 'resume' ? 'Resume — set new start date:' : 'Reschedule first shipment:'}
        </p>
        <input type="date" value={newDate} min={todayISO()} onChange={e => setNewDate(e.target.value)}
               className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
               style={{ borderColor: '#d0d0d0', color: '#3b4858' }} />
        {error && <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>}
        <div className="flex gap-2">
          <button onClick={() => submitDateAction(order.id)} disabled={busy}
                  className="text-sm font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#466c7e' }}>
            {busy ? 'Saving…' : dateAction === 'resume' ? 'Resume Order' : 'Reschedule'}
          </button>
          <button onClick={() => setDatePanel(null)}
                  className="text-sm px-4 py-2 rounded-lg border hover:bg-gray-50"
                  style={{ borderColor: '#d0d0d0', color: '#666' }}>
            Cancel
          </button>
        </div>
      </div>
    )

    return (
      <>
        <div className="px-5 py-3 space-y-1.5">
          {order.order_items.map(item => {
            const variant = item.product_variants
            const name    = variant?.products?.name ?? 'Unknown product'
            const size    = variant?.size ?? ''
            return (
              <div key={item.id} className="flex justify-between text-sm" style={{ color: '#555' }}>
                <span>
                  <span className="font-medium">{item.quantity}×</span>{' '}
                  {name} <span style={{ color: '#999' }}>{size}</span>
                </span>
                <span style={{ color: '#777' }}>{fmtPrice(item.unit_price_cents * item.quantity)}</span>
              </div>
            )
          })}
          {order.notes && (
            <p className="text-xs italic pt-0.5" style={{ color: '#466c7e' }}>Note: {order.notes}</p>
          )}
        </div>

        {canManage && (
          <div className="px-5 py-3 flex flex-wrap gap-2 border-t" style={{ borderColor: '#f5f5f5' }}>
            <button onClick={() => startEdit(order)} disabled={busy}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                    style={{ borderColor: '#d0d0d0', color: '#3b4858' }}>
              Edit
            </button>
            {order.is_recurring && (
              paused ? (
                <button onClick={() => openDatePanel(order, 'resume')} disabled={busy}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-green-50 disabled:opacity-50"
                        style={{ borderColor: '#86efac', color: '#15803d' }}>
                  Resume
                </button>
              ) : (
                <>
                  <button onClick={() => openDatePanel(order, 'reschedule')} disabled={busy}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-50"
                          style={{ borderColor: '#d0d0d0', color: '#3b4858' }}>
                    Reschedule
                  </button>
                  <button onClick={() => pauseOrder(order.id)} disabled={busy}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-yellow-50 disabled:opacity-50"
                          style={{ borderColor: '#fcd34d', color: '#92400e' }}>
                    {busy ? 'Pausing…' : 'Pause'}
                  </button>
                </>
              )
            )}
            <button onClick={() => deleteOrder(order.id)} disabled={busy}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-red-50 disabled:opacity-50"
                    style={{ borderColor: '#fca5a5', color: '#dc2626' }}>
              Delete
            </button>
          </div>
        )}
      </>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-12 text-center" style={{ borderColor: '#e5e5e5' }}>
        <p className="mb-4" style={{ color: '#777777' }}>No orders yet.</p>
        <a href="/products"
           className="inline-block text-white font-semibold px-5 py-2 rounded-lg transition-opacity hover:opacity-90"
           style={{ backgroundColor: '#466c7e' }}>
          Browse Coffees
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
        </div>
      )}

      {/* ── Upcoming schedule ─────────────────────────────────────────────── */}
      {scheduleByDate.size > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-bold" style={{ color: '#3b4858' }}>Upcoming Orders</h2>
            <span className="text-sm" style={{ color: '#999' }}>
              next 6 weeks · through {windowEndLabel}
            </span>
          </div>

          <div className="space-y-5">
            {Array.from(scheduleByDate.entries()).map(([dateISO, dayOrders]) => (
              <div key={dateISO}>
                {/* Date header */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-bold" style={{ color: '#3b4858' }}>
                    {fmtDateLabel(dateISO, today)}
                  </span>
                  <span className="text-xs" style={{ color: '#bbb' }}>
                    {fmtDate(dateISO)}
                  </span>
                  <div className="flex-1 border-t" style={{ borderColor: '#ebebeb' }} />
                  <span className="text-xs" style={{ color: '#bbb' }}>
                    {dayOrders.reduce((s, o) => s + o.order_items.reduce((ss, i) => ss + i.quantity, 0), 0)} bags
                  </span>
                </div>

                <div className="space-y-2">
                  {dayOrders.map((order, i) => (
                    <div key={`${dateISO}-${order.id}-${i}`}
                         className="bg-white rounded-xl border overflow-hidden"
                         style={{ borderColor: '#e5e5e5' }}>
                      {/* Card header */}
                      <div className="flex items-center justify-between px-5 py-3 border-b"
                           style={{ borderColor: '#f5f5f5' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ background: '#f0f4f5', color: '#466c7e' }}>
                            🔄 {RECURRING_LABELS[order.recurring_interval ?? 'biweekly'] ?? order.recurring_interval}
                          </span>
                          <span className="text-xs" style={{ color: '#bbb' }}>Order #{order.id}</span>
                        </div>
                        <span className="text-sm font-semibold" style={{ color: '#3b4858' }}>
                          {fmtPrice(order.total_amount_cents)}
                        </span>
                      </div>
                      <OrderCardBody order={order} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Order history ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-bold mb-4" style={{ color: '#3b4858' }}>Order History</h2>

        <div className="space-y-4">
          {orders.map((order) => {
            const state     = displayState(order)
            const chip      = CHIP[state] ?? CHIP.pending
            const canManage = order.status === 'pending' || order.status === 'confirmed'
            const paused    = state === 'paused'

            return (
              <div key={order.id} className="bg-white rounded-xl border overflow-hidden"
                   style={{ borderColor: '#e5e5e5' }}>
                <div className="flex items-start justify-between px-5 py-4 border-b"
                     style={{ borderColor: '#f0f0f0' }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold" style={{ color: '#3b4858' }}>Order #{order.id}</span>
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full"
                          style={{ background: chip.bg, color: chip.color }}>
                      {state === 'scheduled' && order.scheduled_for
                        ? `Scheduled · ${fmtDate(order.scheduled_for)}`
                        : state.charAt(0).toUpperCase() + state.slice(1)}
                    </span>
                    {order.is_recurring && order.recurring_interval && (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: '#f0f4f5', color: '#466c7e' }}>
                        🔄 {RECURRING_LABELS[order.recurring_interval]}
                        {paused ? ' · Paused' : ''}
                      </span>
                    )}
                    {order.partner_locations && (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: '#f5f5f5', color: '#666' }}>
                        📍 {order.partner_locations.name}
                      </span>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="font-semibold" style={{ color: '#3b4858' }}>
                      {fmtPrice(order.total_amount_cents)}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#999' }}>
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <OrderCardBody order={order} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
