'use client'

import { useState, useEffect } from 'react'
import type { PortalProduct, ProductVariant, CartItem } from '@/types'

const CART_KEY = 'coffee_cart'

// ── Helpers ──────────────────────────────────────────────────────────────────

function discountedPrice(priceCents: number, discountPct: number): number {
  if (discountPct <= 0) return priceCents
  return Math.floor(priceCents * (1 - discountPct / 100))
}

function fmtPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

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

// ── Size badge color ──────────────────────────────────────────────────────────
const SIZE_COLORS: Record<string, string> = {
  '12oz': 'bg-stone-100 text-stone-700',
  '2lb':  'bg-amber-50 text-amber-800',
  '5lb':  'bg-amber-100 text-amber-900',
}

const ROAST_LABELS: Record<string, string> = {
  light:       'Light',
  medium:      'Medium',
  'medium-dark': 'Med-Dark',
  dark:        'Dark',
}

// ── ProductCard ───────────────────────────────────────────────────────────────

interface ProductCardProps {
  product: PortalProduct
  discountPct: number
  onAddToCart: (item: CartItem) => void
  cartCounts: Record<number, number>  // variantId → quantity in cart
}

function ProductCard({ product, discountPct, onAddToCart, cartCounts }: ProductCardProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.product_variants.find((v) => v.is_available) ?? null
  )
  const [qty, setQty] = useState(1)

  const availableVariants = product.product_variants
    .filter((v) => v.is_available)
    .sort((a, b) => {
      const order = { '12oz': 0, '2lb': 1, '5lb': 2 }
      return (order[a.size as keyof typeof order] ?? 0) - (order[b.size as keyof typeof order] ?? 0)
    })

  if (availableVariants.length === 0) return null

  const effectivePrice = selectedVariant
    ? discountedPrice(selectedVariant.price_cents, discountPct)
    : 0

  const inCartQty = selectedVariant ? (cartCounts[selectedVariant.id] ?? 0) : 0

  function handleAdd() {
    if (!selectedVariant) return
    onAddToCart({
      variantId:     selectedVariant.id,
      productId:     product.id,
      productName:   product.name,
      size:          selectedVariant.size as '12oz' | '2lb' | '5lb',
      quantity:      qty,
      unitPriceCents: effectivePrice,
      sku:           selectedVariant.sku,
    })
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 flex flex-col gap-4
                    hover:border-stone-300 hover:shadow-sm transition-all">
      {/* Product info */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-stone-900 text-lg leading-tight">{product.name}</h3>
          {product.roast_level && (
            <span className="text-xs font-medium bg-stone-100 text-stone-600 rounded-full
                             px-2 py-0.5 whitespace-nowrap flex-shrink-0">
              {ROAST_LABELS[product.roast_level] ?? product.roast_level}
            </span>
          )}
        </div>
        {product.origin_region && (
          <p className="text-sm text-stone-500">{product.origin_region}</p>
        )}
        {product.process_method && (
          <p className="text-xs text-stone-400 mt-0.5">{product.process_method}</p>
        )}
        {product.description && (
          <p className="text-sm text-stone-600 mt-2 leading-relaxed line-clamp-2">
            {product.description}
          </p>
        )}
      </div>

      {/* Size selector */}
      <div>
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">Size</p>
        <div className="flex gap-2 flex-wrap">
          {availableVariants.map((v) => (
            <button
              key={v.id}
              onClick={() => { setSelectedVariant(v); setQty(1) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                ${selectedVariant?.id === v.id
                  ? 'border-amber-500 bg-amber-50 text-amber-800'
                  : `border-stone-200 ${SIZE_COLORS[v.size] ?? 'bg-stone-50 text-stone-700'} hover:border-stone-300`
                }`}
            >
              {v.size}
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      {selectedVariant && (
        <div className="flex items-baseline gap-2">
          {discountPct > 0 && (
            <span className="text-stone-400 line-through text-sm">
              {fmtPrice(selectedVariant.price_cents)}
            </span>
          )}
          <span className={`text-xl font-bold ${discountPct > 0 ? 'text-emerald-700' : 'text-stone-900'}`}>
            {fmtPrice(effectivePrice)}
          </span>
          {discountPct > 0 && (
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
              {discountPct}% off
            </span>
          )}
        </div>
      )}

      {/* Quantity + Add to cart */}
      <div className="flex items-center gap-3 mt-auto">
        <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-3 py-2 text-stone-600 hover:bg-stone-50 transition-colors font-medium"
          >
            −
          </button>
          <span className="px-3 py-2 text-stone-800 font-medium min-w-[2.5rem] text-center">
            {qty}
          </span>
          <button
            onClick={() => setQty((q) => q + 1)}
            className="px-3 py-2 text-stone-600 hover:bg-stone-50 transition-colors font-medium"
          >
            +
          </button>
        </div>

        <button
          onClick={handleAdd}
          disabled={!selectedVariant}
          className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white
                     font-semibold py-2 rounded-lg transition-colors text-sm"
        >
          {inCartQty > 0 ? `Add More (${inCartQty} in cart)` : 'Add to Cart'}
        </button>
      </div>
    </div>
  )
}

// ── Toast notification ────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-sm
                  font-medium px-5 py-3 rounded-full shadow-lg transition-all duration-300
                  ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
    >
      {message}
    </div>
  )
}

// ── ProductGrid (main export) ─────────────────────────────────────────────────

interface ProductGridProps {
  products: PortalProduct[]
  discountPct: number
}

export default function ProductGrid({ products, discountPct }: ProductGridProps) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [toast, setToast] = useState({ visible: false, message: '' })

  // Hydrate from localStorage on mount
  useEffect(() => {
    setCart(loadCart())
  }, [])

  // Build a quick lookup: variantId → total quantity in cart
  const cartCounts: Record<number, number> = {}
  for (const item of cart) {
    cartCounts[item.variantId] = (cartCounts[item.variantId] ?? 0) + item.quantity
  }
  const totalCartItems = Object.values(cartCounts).reduce((a, b) => a + b, 0)

  function showToast(message: string) {
    setToast({ visible: true, message })
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2000)
  }

  function handleAddToCart(newItem: CartItem) {
    setCart((prev) => {
      const existing = prev.findIndex((i) => i.variantId === newItem.variantId)
      let updated: CartItem[]
      if (existing >= 0) {
        updated = prev.map((item, i) =>
          i === existing
            ? { ...item, quantity: item.quantity + newItem.quantity }
            : item
        )
      } else {
        updated = [...prev, newItem]
      }
      saveCart(updated)
      return updated
    })
    showToast(`Added ${newItem.quantity}× ${newItem.productName} ${newItem.size} to cart`)
  }

  return (
    <>
      {/* Floating cart button */}
      {totalCartItems > 0 && (
        <div className="fixed bottom-6 right-6 z-10">
          <a
            href="/portal/cart"
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white
                       font-semibold px-5 py-3 rounded-full shadow-lg transition-colors"
          >
            <span>🛒</span>
            <span>Cart</span>
            <span className="bg-white text-amber-700 rounded-full w-6 h-6 flex items-center
                             justify-center text-xs font-bold">
              {totalCartItems}
            </span>
          </a>
        </div>
      )}

      {/* Product grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            discountPct={discountPct}
            onAddToCart={handleAddToCart}
            cartCounts={cartCounts}
          />
        ))}
      </div>

      <Toast message={toast.message} visible={toast.visible} />
    </>
  )
}
