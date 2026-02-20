'use client'

import { useState, useEffect } from 'react'
import type { CartItem } from '@/types'

const CART_KEY = 'coffee_cart'

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

export default function CartView() {
  const [cart, setCart]       = useState<CartItem[]>([])
  const [notes, setNotes]     = useState('')
  const [status, setStatus]   = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setCart(loadCart())
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="text-stone-400 text-sm">Loading cart…</div>
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
        body: JSON.stringify({ items: cart, notes }),
      })

      if (!res.ok) throw new Error('API error')

      clearCart()
      setCart([])
      setNotes('')
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (cart.length === 0 && status !== 'success') {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
        <p className="text-stone-500 mb-4">Your cart is empty.</p>
        <a
          href="/portal/products"
          className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-semibold
                     px-5 py-2 rounded-lg transition-colors"
        >
          Browse Coffees
        </a>
      </div>
    )
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h2 className="text-xl font-bold text-stone-800 mb-2">Order Placed!</h2>
        <p className="text-stone-500 mb-6">
          We&apos;ve received your order and will be in touch once it&apos;s confirmed.
        </p>
        <div className="flex gap-3 justify-center">
          <a
            href="/portal/products"
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold
                       px-5 py-2 rounded-lg transition-colors"
          >
            Place Another Order
          </a>
          <a
            href="/portal/orders"
            className="border border-stone-300 text-stone-700 hover:border-stone-400
                       font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            View Order History
          </a>
        </div>
      </div>
    )
  }

  // ── Cart items ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Line items */}
      <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
        {cart.map((item) => (
          <div key={item.variantId} className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-stone-900 truncate">{item.productName}</p>
              <p className="text-sm text-stone-500">{item.size} — {fmtPrice(item.unitPriceCents)} each</p>
            </div>

            {/* Quantity controls */}
            <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden">
              <button
                onClick={() => updateQty(item.variantId, item.quantity - 1)}
                className="px-2.5 py-1.5 text-stone-600 hover:bg-stone-50 transition-colors"
              >
                −
              </button>
              <span className="px-3 py-1.5 text-stone-800 font-medium min-w-[2rem] text-center text-sm">
                {item.quantity}
              </span>
              <button
                onClick={() => updateQty(item.variantId, item.quantity + 1)}
                className="px-2.5 py-1.5 text-stone-600 hover:bg-stone-50 transition-colors"
              >
                +
              </button>
            </div>

            {/* Line total */}
            <span className="text-stone-800 font-medium w-20 text-right">
              {fmtPrice(item.unitPriceCents * item.quantity)}
            </span>

            {/* Remove */}
            <button
              onClick={() => removeItem(item.variantId)}
              className="text-stone-300 hover:text-red-500 transition-colors ml-1"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Order total */}
      <div className="flex justify-between items-center px-5 py-4 bg-white rounded-xl
                      border border-stone-200 font-semibold text-stone-800">
        <span>Order Total</span>
        <span className="text-xl">{fmtPrice(total)}</span>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-stone-700 mb-1">
          Order Notes <span className="text-stone-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special instructions or delivery notes…"
          rows={3}
          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 text-sm
                     focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
        />
      </div>

      {/* Error */}
      {status === 'error' && (
        <p className="text-red-600 text-sm">Something went wrong placing your order. Please try again.</p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href="/portal/products"
          className="flex-shrink-0 border border-stone-300 text-stone-600 hover:border-stone-400
                     font-medium px-4 py-3 rounded-lg transition-colors text-sm"
        >
          ← Continue Shopping
        </a>
        <button
          onClick={handlePlaceOrder}
          disabled={status === 'submitting'}
          className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white
                     font-semibold py-3 rounded-lg transition-colors"
        >
          {status === 'submitting' ? 'Placing Order…' : 'Place Order'}
        </button>
      </div>
    </div>
  )
}
