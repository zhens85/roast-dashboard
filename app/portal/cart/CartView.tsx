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

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (cart.length === 0 && status !== 'success') {
    return (
      <div className="bg-white rounded-xl border p-12 text-center"
           style={{ borderColor: '#e5e5e5' }}>
        <p className="mb-4" style={{ color: '#777777' }}>Your cart is empty.</p>
        <a
          href="/portal/products"
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
        <p className="mb-6" style={{ color: '#777777' }}>
          We&apos;ve received your order and will be in touch once it&apos;s confirmed.
        </p>
        <div className="flex gap-3 justify-center">
          <a
            href="/portal/products"
            className="text-white font-semibold px-5 py-2 rounded-lg
                       transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#466c7e' }}
          >
            Place Another Order
          </a>
          <a
            href="/portal/orders"
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

      {/* Error */}
      {status === 'error' && (
        <p className="text-sm" style={{ color: '#d60000' }}>
          Something went wrong placing your order. Please try again.
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <a
          href="/portal/products"
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
