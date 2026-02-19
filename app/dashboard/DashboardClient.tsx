'use client'

import { useState, useMemo, useTransition } from 'react'
import type { DashboardOrder, RoastLine, PackagingOrder } from '@/types'
import { buildRoastSchedule, buildPackagingList, fmtLbs } from '@/lib/calculations'

interface Props {
  initialOrders: DashboardOrder[]
}

export default function DashboardClient({ initialOrders }: Props) {
  const [selectedIds, setSelectedIds]     = useState<Set<number>>(new Set())
  const [lossOverrides, setLossOverrides] = useState<Record<number, number>>({})
  const [isPending, startTransition]      = useTransition()
  const [confirmStatus, setConfirmStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const selectedOrders = useMemo(
    () => initialOrders.filter((o) => selectedIds.has(o.id)),
    [initialOrders, selectedIds]
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
      selectedIds.size === initialOrders.length
        ? new Set()
        : new Set(initialOrders.map((o) => o.id))
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

  const printUrl = `/dashboard/print?orders=${Array.from(selectedIds).join(',')}`

  return (
    <div className="space-y-8">

      {/* ── ORDER QUEUE ── */}
      <section>
        <div className="flex items-center gap-4 mb-3">
          <h2 className="text-xl font-semibold text-stone-800">Order Queue</h2>
          {initialOrders.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-xs text-amber-700 underline hover:text-amber-900"
            >
              {selectedIds.size === initialOrders.length ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>

        {initialOrders.length === 0 ? (
          <div className="bg-white rounded-lg border border-stone-200 p-8 text-center text-stone-500">
            No pending orders. All caught up!
          </div>
        ) : (
          <div className="space-y-2">
            {initialOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => toggleOrder(order.id)}
                className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors
                  ${selectedIds.has(order.id)
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(order.id)}
                  readOnly
                  className="mt-0.5 h-4 w-4 accent-amber-600 cursor-pointer flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-medium text-stone-900">
                      {order.partners.company_name}
                    </span>
                    <span className="text-stone-400 text-sm">#{order.id}</span>
                    <span className="text-stone-500 text-sm">
                      — {order.partners.contact_person}
                    </span>
                  </div>
                  <div className="text-sm text-stone-500 mt-0.5">
                    {new Date(order.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-3 mt-1">
                    {order.order_items.map((item) => (
                      <span key={item.id} className="text-sm text-stone-600">
                        {item.product_variants.products.name} {item.product_variants.size} ×{item.quantity}
                      </span>
                    ))}
                  </div>
                  {order.notes && (
                    <div className="text-xs text-amber-700 mt-1 italic">
                      Note: {order.notes}
                    </div>
                  )}
                </div>
                <div className="text-sm font-medium text-stone-700 whitespace-nowrap flex-shrink-0">
                  ${(order.total_amount_cents / 100).toFixed(2)}
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
            <h2 className="text-xl font-semibold text-stone-800 mb-3">
              Roast Schedule
              <span className="text-sm font-normal text-stone-500 ml-2">
                ({selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''} selected)
              </span>
            </h2>
            <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3">Coffee</th>
                    <th className="text-right px-4 py-3">Finished (lbs)</th>
                    <th className="text-center px-4 py-3">Loss Factor</th>
                    <th className="text-right px-4 py-3">Green (lbs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {roastSchedule.map((line) => (
                    <tr key={line.productId} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium text-stone-900">{line.productName}</td>
                      <td className="px-4 py-3 text-right text-stone-700">
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
                          className="w-20 border border-stone-300 rounded px-2 py-1 text-center
                                     text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-800">
                        {fmtLbs(line.greenWeightLbs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-stone-50 border-t-2 border-stone-200">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-stone-700">Total</td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-700">
                      {fmtLbs(roastSchedule.reduce((s, l) => s + l.finishedWeightLbs, 0))}
                    </td>
                    <td />
                    <td className="px-4 py-3 text-right font-bold text-amber-800">
                      {fmtLbs(roastSchedule.reduce((s, l) => s + l.greenWeightLbs, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* ── PACKAGING TOTALS ── */}
          <section>
            <h2 className="text-xl font-semibold text-stone-800 mb-3">Packaging — Totals</h2>
            <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3">Coffee</th>
                    <th className="text-center px-4 py-3">12oz</th>
                    <th className="text-center px-4 py-3">2lb</th>
                    <th className="text-center px-4 py-3">5lb</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {roastSchedule.map((line) => (
                    <tr key={line.productId}>
                      <td className="px-4 py-3 font-medium text-stone-900">{line.productName}</td>
                      <td className="px-4 py-3 text-center text-stone-700">
                        {line.bagCounts['12oz'] > 0 ? `${line.bagCounts['12oz']}×` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-stone-700">
                        {line.bagCounts['2lb'] > 0 ? `${line.bagCounts['2lb']}×` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-stone-700">
                        {line.bagCounts['5lb'] > 0 ? `${line.bagCounts['5lb']}×` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── PACKAGING PER ORDER ── */}
          <section>
            <h2 className="text-xl font-semibold text-stone-800 mb-3">Packaging — Per Order</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {packagingList.map((packOrder) => (
                <div
                  key={packOrder.orderId}
                  className="bg-white rounded-lg border border-stone-200 p-4"
                >
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold text-stone-900">{packOrder.companyName}</span>
                    <span className="text-stone-400 text-xs">#{packOrder.orderId}</span>
                    <span className="text-stone-500 text-sm">— {packOrder.partnerName}</span>
                  </div>
                  {packOrder.notes && (
                    <p className="text-xs text-amber-700 italic mb-2">Note: {packOrder.notes}</p>
                  )}
                  <ul className="space-y-0.5 mt-2">
                    {packOrder.items.map((item, i) => (
                      <li key={i} className="text-sm text-stone-700">
                        <span className="font-medium">{item.quantity}×</span>{' '}
                        {item.productName} <span className="text-stone-500">{item.size}</span>
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
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white
                         font-semibold px-6 py-3 rounded-lg transition-colors"
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
              className="text-sm text-stone-600 underline hover:text-stone-900"
            >
              Open print view →
            </a>

            {confirmStatus === 'error' && (
              <span className="text-red-600 text-sm">Something went wrong. Try again.</span>
            )}
          </section>
        </>
      )}
    </div>
  )
}
