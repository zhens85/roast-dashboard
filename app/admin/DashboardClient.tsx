'use client'

import { useState, useMemo, useTransition } from 'react'
import type { DashboardOrder, RoastLine, PackagingOrder } from '@/types'
import { buildRoastSchedule, buildPackagingList, fmtLbs } from '@/lib/calculations'

interface Props {
  initialOrders: DashboardOrder[]
}

export default function DashboardClient({ initialOrders }: Props) {
  const [orders, setOrders]               = useState<DashboardOrder[]>(initialOrders)
  const [selectedIds, setSelectedIds]     = useState<Set<number>>(new Set())
  const [lossOverrides, setLossOverrides] = useState<Record<number, number>>({})
  const [isPending, startTransition]      = useTransition()
  const [confirmStatus, setConfirmStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [cancellingId, setCancellingId]   = useState<number | null>(null)
  const [cancelError, setCancelError]     = useState<string | null>(null)

  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedIds.has(o.id)),
    [orders, selectedIds]
  )

  const roastSchedule: RoastLine[] = useMemo(
    () => buildRoastSchedule(selectedOrders, lossOverrides),
    [selectedOrders, lossOverrides]
  )

  const packagingList: PackagingOrder[] = useMemo(
    () => buildPackagingList(selectedOrders),
    [selectedOrders]
  )

  function toggleOrder(orderId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(orderId) ? next.delete(orderId) : next.add(orderId)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds(
      selectedIds.size === orders.length
        ? new Set()
        : new Set(orders.map((o) => o.id))
    )
  }

  function setLossOverride(productId: number, value: string) {
    const num = parseFloat(value)
    if (!isNaN(num) && num > 0 && num < 1) {
      setLossOverrides((prev) => ({ ...prev, [productId]: num }))
    }
  }

  async function handleConfirmRun() {
    if (selectedIds.size === 0) return
    startTransition(async () => {
      try {
        const res = await fetch('/api/orders/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds: Array.from(selectedIds) }),
        })
        if (!res.ok) throw new Error('API error')
        setConfirmStatus('success')
        setTimeout(() => window.location.reload(), 2000)
      } catch {
        setConfirmStatus('error')
      }
    })
  }

  async function handleCancelOrder(e: React.MouseEvent, orderId: number) {
    e.stopPropagation()
    if (!window.confirm('Cancel this order? The partner will need to resubmit if needed.')) return

    setCancellingId(orderId)
    setCancelError(null)
    try {
      const res = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: [orderId] }),
      })
      if (!res.ok) throw new Error('API error')

      setOrders((prev) => prev.filter((o) => o.id !== orderId))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
    } catch {
      setCancelError(`Could not cancel order #${orderId}. Please try again.`)
    } finally {
      setCancellingId(null)
    }
  }

  const printUrl = `/admin/print?orders=${Array.from(selectedIds).join(',')}`

  return (
    <div className="space-y-8">

      {/* ── ORDER QUEUE ── */}
      <section>
        <div className="flex items-center gap-4 mb-3">
          <h2 className="text-xl font-semibold" style={{ color: '#3b4858' }}>Order Queue</h2>
          {orders.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-xs underline hover:opacity-70 transition-opacity"
              style={{ color: '#466c7e' }}
            >
              {selectedIds.size === orders.length ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>

        {cancelError && (
          <p className="mb-2 text-sm" style={{ color: '#d60000' }}>{cancelError}</p>
        )}

        {orders.length === 0 ? (
          <div className="bg-white rounded-xl border p-8 text-center"
               style={{ borderColor: '#e5e5e5', color: '#777777' }}>
            No pending orders. All caught up!
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() => toggleOrder(order.id)}
                className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all"
                style={selectedIds.has(order.id)
                  ? { borderColor: '#466c7e', backgroundColor: '#f0f4f5' }
                  : { borderColor: '#e5e5e5', backgroundColor: 'white' }
                }
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(order.id)}
                  readOnly
                  className="mt-0.5 h-4 w-4 cursor-pointer flex-shrink-0"
                  style={{ accentColor: '#466c7e' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-medium" style={{ color: '#3b4858' }}>
                      {order.partners.company_name}
                    </span>
                    <span className="text-sm" style={{ color: '#bbb' }}>#{order.id}</span>
                    <span className="text-sm" style={{ color: '#777777' }}>
                      — {order.partners.contact_person}
                    </span>
                  </div>
                  <div className="text-sm mt-0.5" style={{ color: '#999' }}>
                    {new Date(order.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-3 mt-1">
                    {order.order_items.map((item) => (
                      <span key={item.id} className="text-sm" style={{ color: '#555' }}>
                        {item.product_variants.products.name} {item.product_variants.size} ×{item.quantity}
                      </span>
                    ))}
                  </div>
                  {order.notes && (
                    <div className="text-xs mt-1 italic" style={{ color: '#466c7e' }}>
                      Note: {order.notes}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-sm font-medium whitespace-nowrap" style={{ color: '#3b4858' }}>
                    ${(order.total_amount_cents / 100).toFixed(2)}
                  </div>
                  <button
                    onClick={(e) => handleCancelOrder(e, order.id)}
                    disabled={cancellingId === order.id}
                    className="text-xs underline whitespace-nowrap disabled:opacity-50
                               hover:opacity-70 transition-opacity"
                    style={{ color: '#d60000' }}
                  >
                    {cancellingId === order.id ? 'Cancelling…' : 'Cancel'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selectedOrders.length > 0 && (
        <>
          {/* ── ROAST SCHEDULE ── */}
          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: '#3b4858' }}>
              Roast Schedule
              <span className="text-sm font-normal ml-2" style={{ color: '#999' }}>
                ({selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''} selected)
              </span>
            </h2>
            <div className="bg-white rounded-xl border overflow-hidden"
                 style={{ borderColor: '#e5e5e5' }}>
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: '#fafafa' }}>
                  <tr>
                    {['Coffee', 'Finished (lbs)', 'Loss Factor', 'Green (lbs)'].map((h, i) => (
                      <th key={h}
                          className={`px-4 py-3 text-xs font-medium uppercase tracking-wide
                                      ${i === 0 ? 'text-left' : i === 2 ? 'text-center' : 'text-right'}`}
                          style={{ color: '#999' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roastSchedule.map((line, i) => (
                    <tr key={line.productId}
                        style={{ borderTop: i > 0 ? '1px solid #f0f0f0' : undefined }}>
                      <td className="px-4 py-3 font-medium" style={{ color: '#3b4858' }}>
                        {line.productName}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: '#555' }}>
                        {fmtLbs(line.finishedWeightLbs)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0.01"
                          max="0.99"
                          step="0.01"
                          value={line.roastLossFactorOverride}
                          onChange={(e) => setLossOverride(line.productId, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-20 border rounded px-2 py-1 text-center text-sm
                                     focus:outline-none focus:ring-2"
                          style={{ borderColor: '#d0d0d0', color: '#3b4858' }}
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: '#466c7e' }}>
                        {fmtLbs(line.greenWeightLbs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot style={{ borderTop: '2px solid #e5e5e5', backgroundColor: '#fafafa' }}>
                  <tr>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#3b4858' }}>Total</td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: '#555' }}>
                      {fmtLbs(roastSchedule.reduce((s, l) => s + l.finishedWeightLbs, 0))}
                    </td>
                    <td />
                    <td className="px-4 py-3 text-right font-bold" style={{ color: '#466c7e' }}>
                      {fmtLbs(roastSchedule.reduce((s, l) => s + l.greenWeightLbs, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* ── PACKAGING TOTALS ── */}
          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: '#3b4858' }}>
              Packaging — Totals
            </h2>
            <div className="bg-white rounded-xl border overflow-hidden"
                 style={{ borderColor: '#e5e5e5' }}>
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: '#fafafa' }}>
                  <tr>
                    {['Coffee', '12oz', '2lb', '5lb'].map((h, i) => (
                      <th key={h}
                          className={`px-4 py-3 text-xs font-medium uppercase tracking-wide
                                      ${i === 0 ? 'text-left' : 'text-center'}`}
                          style={{ color: '#999' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roastSchedule.map((line, i) => (
                    <tr key={line.productId}
                        style={{ borderTop: i > 0 ? '1px solid #f0f0f0' : undefined }}>
                      <td className="px-4 py-3 font-medium" style={{ color: '#3b4858' }}>
                        {line.productName}
                      </td>
                      {(['12oz', '2lb', '5lb'] as const).map((size) => (
                        <td key={size} className="px-4 py-3 text-center" style={{ color: '#555' }}>
                          {line.bagCounts[size] > 0 ? `${line.bagCounts[size]}×` : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── PACKAGING PER ORDER ── */}
          <section>
            <h2 className="text-xl font-semibold mb-3" style={{ color: '#3b4858' }}>
              Packaging — Per Order
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {packagingList.map((packOrder) => (
                <div
                  key={packOrder.orderId}
                  className="bg-white rounded-xl border p-4"
                  style={{ borderColor: '#e5e5e5' }}
                >
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold" style={{ color: '#3b4858' }}>
                      {packOrder.companyName}
                    </span>
                    <span className="text-xs" style={{ color: '#bbb' }}>#{packOrder.orderId}</span>
                    <span className="text-sm" style={{ color: '#777' }}>— {packOrder.partnerName}</span>
                  </div>
                  {packOrder.notes && (
                    <p className="text-xs italic mb-2" style={{ color: '#466c7e' }}>
                      Note: {packOrder.notes}
                    </p>
                  )}
                  <ul className="space-y-0.5 mt-2">
                    {packOrder.items.map((item, i) => (
                      <li key={i} className="text-sm" style={{ color: '#555' }}>
                        <span className="font-medium">{item.quantity}×</span>{' '}
                        {item.productName}{' '}
                        <span style={{ color: '#999' }}>{item.size}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* ── ACTIONS ── */}
          <section className="flex items-center gap-4 pb-10 flex-wrap">
            <button
              onClick={handleConfirmRun}
              disabled={isPending || confirmStatus === 'success'}
              className="text-white font-semibold px-6 py-3 rounded-lg transition-opacity
                         hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#466c7e' }}
            >
              {isPending
                ? 'Confirming…'
                : confirmStatus === 'success'
                ? '✓ Confirmed!'
                : `Confirm Roast Run (${selectedIds.size} order${selectedIds.size !== 1 ? 's' : ''})`}
            </button>

            <a
              href={printUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline hover:opacity-70 transition-opacity"
              style={{ color: '#466c7e' }}
            >
              Open print view →
            </a>

            {confirmStatus === 'error' && (
              <span className="text-sm" style={{ color: '#d60000' }}>
                Something went wrong. Try again.
              </span>
            )}
          </section>
        </>
      )}
    </div>
  )
}
