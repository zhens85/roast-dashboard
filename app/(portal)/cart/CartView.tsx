'use client'

import { useState, useEffect } from 'react'
import type { CartItem } from '@/types'

const CART_KEY = 'coffee_cart'

const RECURRING_INTERVALS = [
  { value: 'weekly',        label: 'Weekly' },
  { value: 'biweekly',      label: 'Every 2 Weeks' },
  { value: 'monthly',       label: 'Monthly' },
  { value: 'every_6_weeks', label: 'Every 6 Weeks' },
  { value: 'every_8_weeks', label: 'Every 8 Weeks' },
] as const

type RecurringInterval = typeof RECURRING_INTERVALS[number]['value']

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveCart(cart: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
}

function clearCart() {
  localStorage.removeItem(CART_KEY)
}

function fmtPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function intervalLabel(value: RecurringInterval): string {
  return RECURRING_INTERVALS.find((i) => i.value === value)?.label ?? value
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function fmtDate(iso: string): string {
  // e.g. "2026-06-07" → "Jun 7, 2026"
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CartView() {
  const [cart, setCart]                           = useState<CartItem[]>([])
  const [notes, setNotes]                         = useState('')
  const [isRecurring, setIsRecurring]             = useState(false)
  const [recurringInterval, setRecurringInterval] = useState<RecurringInterval>('biweekly')
  const [scheduledFor, setScheduledFor]           = useState(todayISO())
  const [status, setStatus]                       = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [lastOrder, setLastOrder]                 = useState<{ id: number; isRecurring: boolean; interval: RecurringInterval | null; scheduledFor: string | null } | null>(null)
  const [mounted, setMounted]                     = useState(false)

  useEffect(() => {
    setCart(loadCart())
    setMounted(true)
    setScheduledFor(todayISO())
  }, [])

  if (!mounted) {
    return <div className="text-sm" style={{ color: '#999' }}>Loading cart…</div>
  }

  function updateQty(variantId: number, newQty: number) {
    setCart((prev) => {
      const updated = newQty <= 0
        ? prev.filter((i) => i.variantId !== variantId)
        : prev.map((i) => i.variantId === variantId ? { ...i, quantity: newQty } : i)
      saveCart(updated)
      return updated
    })
  }

  function removeItem(variantId: number) {
    setCart((prev) => {
      const updated = prev.filter((i) => i.variantId !== variantId)
      saveCart(updated)
      return updated
    })
  }

  const total = cart.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)

  async function handlePlaceOrder() {
    if (cart.length === 0 || status === 'submitting') return
    setStatus('submitting')
    try {
      const res = await fetch('/api/portal/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          notes,
          is_recurring:       isRecurring,
          recurring_interval: isRecurring ? recurringInterval : null,
          scheduled_for:      isRecurring ? scheduledFor : null,
        }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      clearCart()
      setCart([])
      setNotes('')
      setLastOrder({ id: data.orderId, isRecurring: data.is_recurring, interval: data.recurring_interval, scheduledFor: data.scheduled_for })
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (cart.length === 0 && status !== 'success') {
    return (
      <div className="bg-white rounded-xl border p-12 text-center"
           style={{ borderColor: '#e5e5e5' }}>
        <p className="mb-4" style={{ color: '#777777' }}>Your cart is empty.</p>
        <a
          href="/products"
          className="inline-block text-white font-semibold px-5 py-2 rounded-lg
                     transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#466c7e' }}
        >
          Browse Coffees
        </a>
      </div>
    )
  }

  // ── Success state ───────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className="bg-white rounded-xl border p-12 text-center"
           style={{ borderColor: '#e5e5e5' }}>
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#3b4858' }}>Order Placed!</h2>
        <p style={{ color: '#777777' }}>
          We&apos;ve received your order and will be in touch once it&apos;s confirmed.
        </p>
        {lastOrder?.isRecurring && lastOrder.interval && (
          <p className="mt-2 text-sm font-medium" style={{ color: '#466c7e' }}>
            🔄 Repeats {intervalLabel(lastOrder.interval).toLowerCase()}
            {lastOrder.scheduledFor
              ? `, starting ${fmtDate(lastOrder.scheduledFor)}.`
              : '.'}
          </p>
        )}
        <div className="flex gap-3 justify-center mt-6">
          <a
            href="/products"
            className="text-white font-semibold px-5 py-2 rounded-lg
                       transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#466c7e' }}
          >
            Place Another Order
          </a>
          <a
            href="/orders"
            className="border font-semibold px-5 py-2 rounded-lg transition-colors hover:bg-gray-50"
            style={{ borderColor: '#d0d0d0', color: '#3b4858' }}
          >
            View Order History
          </a>
        </div>
      </div>
    )
  }

  // ── Cart items ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Line items */}
      <div className="bg-white rounded-xl border divide-y" style={{ borderColor: '#e5e5e5' }}>
        {cart.map((item) => (
          <div key={item.variantId} className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate" style={{ color: '#3b4858' }}>{item.productName}</p>
              <p className="text-sm" style={{ color: '#777777' }}>
                {item.size} — {fmtPrice(item.unitPriceCents)} each
              </p>
            </div>

            {/* Quantity controls */}
            <div className="flex items-center border rounded-lg overflow-hidden"
                 style={{ borderColor: '#d0d0d0' }}>
              <button
                onClick={() => updateQty(item.variantId, item.quantity - 1)}
                className="px-2.5 py-1.5 transition-colors hover:bg-gray-50"
                style={{ color: '#466c7e' }}
              >
                −
              </button>
              <span className="px-3 py-1.5 font-medium min-w-[2rem] text-center text-sm"
                    style={{ color: '#3b4858' }}>
                {item.quantity}
              </span>
              <button
                onClick={() => updateQty(item.variantId, item.quantity + 1)}
                className="px-2.5 py-1.5 transition-colors hover:bg-gray-50"
                style={{ color: '#466c7e' }}
              >
                +
              </button>
            </div>

            {/* Line total */}
            <span className="font-medium w-20 text-right" style={{ color: '#3b4858' }}>
              {fmtPrice(item.unitPriceCents * item.quantity)}
            </span>

            {/* Remove */}
            <button
              onClick={() => removeItem(item.variantId)}
              className="transition-colors hover:opacity-70 ml-1"
              style={{ color: '#ccc' }}
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Order total */}
      <div className="flex justify-between items-center px-5 py-4 bg-white rounded-xl border font-semibold"
           style={{ borderColor: '#e5e5e5', color: '#3b4858' }}>
        <span>Order Total</span>
        <span className="text-xl">{fmtPrice(total)}</span>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-1"
               style={{ color: '#3b4858' }}>
          Order Notes{' '}
          <span className="font-normal" style={{ color: '#999' }}>(optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special instructions or delivery notes…"
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
          style={{ borderColor: '#d0d0d0', color: '#3b4858' }}
        />
      </div>

      {/* Recurring order */}
      <div className="bg-white rounded-xl border px-5 py-4" style={{ borderColor: '#e5e5e5' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium" style={{ color: '#3b4858' }}>Recurring Order</p>
            <p className="text-sm" style={{ color: '#999' }}>
              Repeat this order automatically on a schedule
            </p>
          </div>
          {/* Toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={isRecurring}
            onClick={() => setIsRecurring((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${isRecurring ? 'bg-[#466c7e]' : 'bg-gray-200'}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isRecurring ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </button>
        </div>

        {isRecurring && (
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="scheduledFor" className="block text-sm font-medium mb-1"
                     style={{ color: '#3b4858' }}>
                First shipment date
              </label>
              <input
                id="scheduledFor"
                type="date"
                value={scheduledFor}
                min={todayISO()}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: '#d0d0d0', color: '#3b4858' }}
              />
              <p className="text-xs mt-1" style={{ color: '#999' }}>
                Set a future date to stagger multiple recurring orders.
              </p>
            </div>
            <div>
              <label htmlFor="recurringInterval" className="block text-sm font-medium mb-1"
                     style={{ color: '#3b4858' }}>
                Frequency
              </label>
              <select
                id="recurringInterval"
                value={recurringInterval}
                onChange={(e) => setRecurringInterval(e.target.value as RecurringInterval)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: '#d0d0d0', color: '#3b4858' }}
              >
                {RECURRING_INTERVALS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {status === 'error' && (
        <p className="text-sm" style={{ color: '#d60000' }}>
          Something went wrong placing your order. Please try again.
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href="/products"
          className="flex-shrink-0 border font-medium px-4 py-3 rounded-lg transition-colors
                     hover:bg-gray-50 text-sm"
          style={{ borderColor: '#d0d0d0', color: '#466c7e' }}
        >
          ← Continue Shopping
        </a>
        <button
          onClick={handlePlaceOrder}
          disabled={status === 'submitting'}
          className="flex-1 text-white font-semibold py-3 rounded-lg transition-opacity
                     hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#466c7e' }}
        >
          {status === 'submitting' ? 'Placing Order…' : 'Place Order'}
        </button>
      </div>
    </div>
  )
}
