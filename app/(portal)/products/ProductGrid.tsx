'use client'

import { useState, useEffect } from 'react'
import type { PortalProduct, ProductVariant, CartItem, TierDiscountRule } from '@/types'

const CART_KEY = 'coffee_cart'

// ── Helpers ──────────────────────────────────────────────────────────────────

function discountedPrice(priceCents: number, rule?: TierDiscountRule): number {
  if (!rule) return priceCents
  if (rule.discount_type === 'amount_per_bag' && rule.discount_amount_cents > 0) {
    return Math.max(0, priceCents - rule.discount_amount_cents)
  }
  if (rule.discount_type === 'percentage' && Number(rule.discount_pct) > 0) {
    return Math.floor(priceCents * (1 - Number(rule.discount_pct) / 100))
  }
  return priceCents
}

function discountLabel(rule?: TierDiscountRule): string | null {
  if (!rule) return null
  if (rule.discount_type === 'amount_per_bag' && rule.discount_amount_cents > 0) {
    return `$${(rule.discount_amount_cents / 100).toFixed(2)} off`
  }
  if (rule.discount_type === 'percentage' && Number(rule.discount_pct) > 0) {
    return `${Number(rule.discount_pct)}% off`
  }
  return null
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

const ROAST_LABELS: Record<string, string> = {
  light:         'Light',
  medium:        'Medium',
  'medium-dark': 'Med-Dark',
  dark:          'Dark',
}

// ── ProductCard ───────────────────────────────────────────────────────────────

interface ProductCardProps {
  product:      PortalProduct
  ruleBySize:   Partial<Record<'12oz' | '2lb' | '5lb', TierDiscountRule>>
  onAddToCart:  (item: CartItem) => void
  cartCounts:   Record<number, number>
}

function ProductCard({ product, ruleBySize, onAddToCart, cartCounts }: ProductCardProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(() => {
    const available = product.product_variants.filter((v) => v.is_available)
    return (
      available.find((v) => v.size === '5lb') ??
      available.find((v) => v.size === '2lb') ??
      available[0] ??
      null
    )
  })
  const [qty, setQty] = useState(1)

  const availableVariants = product.product_variants
    .filter((v) => v.is_available)
    .sort((a, b) => {
      const order = { '12oz': 0, '2lb': 1, '5lb': 2 }
      return (order[a.size as keyof typeof order] ?? 0) - (order[b.size as keyof typeof order] ?? 0)
    })

  if (availableVariants.length === 0) return null

  const selectedRule   = selectedVariant ? ruleBySize[selectedVariant.size as '12oz' | '2lb' | '5lb'] : undefined
  const effectivePrice = selectedVariant ? discountedPrice(selectedVariant.price_cents, selectedRule) : 0
  const activeLabel    = discountLabel(selectedRule)
  const inCartQty      = selectedVariant ? (cartCounts[selectedVariant.id] ?? 0) : 0

  function handleAdd() {
    if (!selectedVariant) return
    onAddToCart({
      variantId:      selectedVariant.id,
      productId:      product.id,
      productName:    product.name,
      size:           selectedVariant.size as '12oz' | '2lb' | '5lb',
      quantity:       qty,
      unitPriceCents: effectivePrice,
      sku:            selectedVariant.sku,
    })
  }

  return (
    <div className="bg-white rounded-xl border flex flex-col gap-4 overflow-hidden
                    hover:shadow-md transition-all"
         style={{ borderColor: '#e5e5e5' }}>

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Product info */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-lg leading-tight" style={{ color: '#3b4858' }}>
              {product.name}
            </h3>
            {product.roast_level && (
              <span className="text-xs font-medium rounded-full px-2 py-0.5 whitespace-nowrap flex-shrink-0"
                    style={{ backgroundColor: '#f0f4f5', color: '#466c7e' }}>
                {ROAST_LABELS[product.roast_level] ?? product.roast_level}
              </span>
            )}
          </div>
          {product.origin_region && (
            <p className="text-sm" style={{ color: '#777777' }}>{product.origin_region}</p>
          )}
          {product.process_method && (
            <p className="text-xs mt-0.5" style={{ color: '#999' }}>{product.process_method}</p>
          )}
          {product.description && (
            <p className="text-sm mt-2 leading-relaxed line-clamp-2" style={{ color: '#555' }}>
              {product.description}
            </p>
          )}
        </div>

        {/* Size selector — shows a discount badge per size when applicable */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#999' }}>
            Size
          </p>
          <div className="flex gap-2 flex-wrap">
            {availableVariants.map((v) => {
              const rule  = ruleBySize[v.size as '12oz' | '2lb' | '5lb']
              const label = discountLabel(rule)
              return (
                <button
                  key={v.id}
                  onClick={() => { setSelectedVariant(v); setQty(1) }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-all flex items-center gap-1"
                  style={selectedVariant?.id === v.id
                    ? { borderColor: '#466c7e', backgroundColor: '#f0f4f5', color: '#466c7e' }
                    : { borderColor: '#e5e5e5', backgroundColor: '#fafafa', color: '#555' }
                  }
                >
                  {v.size}
                  {label && (
                    <span className="text-xs font-semibold" style={{ color: '#2d7a4f' }}>
                      −{label}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Price */}
        {selectedVariant && (
          <div className="flex items-baseline gap-2">
            {activeLabel && (
              <span className="text-sm line-through" style={{ color: '#bbb' }}>
                {fmtPrice(selectedVariant.price_cents)}
              </span>
            )}
            <span className="text-xl font-bold" style={{ color: '#3b4858' }}>
              {fmtPrice(effectivePrice)}
            </span>
            {activeLabel && (
              <span className="text-xs font-medium rounded-full px-2 py-0.5"
                    style={{ backgroundColor: '#eaf4ef', color: '#2d7a4f' }}>
                {activeLabel}
              </span>
            )}
          </div>
        )}

        {/* Quantity + Add to cart */}
        <div className="flex items-center gap-3 mt-auto">
          <div className="flex items-center border rounded-lg overflow-hidden"
               style={{ borderColor: '#d0d0d0' }}>
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="px-3 py-2 font-medium transition-colors hover:bg-gray-50"
              style={{ color: '#466c7e' }}
            >
              −
            </button>
            <span className="px-3 py-2 font-medium min-w-[2.5rem] text-center text-sm"
                  style={{ color: '#3b4858' }}>
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="px-3 py-2 font-medium transition-colors hover:bg-gray-50"
              style={{ color: '#466c7e' }}
            >
              +
            </button>
          </div>

          <button
            onClick={handleAdd}
            disabled={!selectedVariant}
            className="flex-1 text-white font-semibold py-2 rounded-lg transition-opacity
                       hover:opacity-90 disabled:opacity-40 text-sm"
            style={{ backgroundColor: '#466c7e' }}
          >
            {inCartQty > 0 ? `Add More (${inCartQty} in cart)` : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Toast notification ────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 text-white text-sm
                  font-medium px-5 py-3 rounded-full shadow-lg transition-all duration-300
                  ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
      style={{ backgroundColor: '#3b4858' }}
    >
      {message}
    </div>
  )
}

// ── ProductGrid (main export) ─────────────────────────────────────────────────

interface ProductGridProps {
  products:      PortalProduct[]
  discountRules: TierDiscountRule[]
}

export default function ProductGrid({ products, discountRules }: ProductGridProps) {
  const [cart, setCart]   = useState<CartItem[]>([])
  const [toast, setToast] = useState({ visible: false, message: '' })

  useEffect(() => {
    setCart(loadCart())
  }, [])

  // Build a size → rule lookup for fast per-card access
  const ruleBySize = Object.fromEntries(
    discountRules.map((r) => [r.size, r])
  ) as Partial<Record<'12oz' | '2lb' | '5lb', TierDiscountRule>>

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
          i === existing ? { ...item, quantity: item.quantity + newItem.quantity } : item
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
      {totalCartItems > 0 && (
        <div className="fixed bottom-6 right-6 z-10">
          <a
            href="/cart"
            className="flex items-center gap-2 text-white font-semibold px-5 py-3
                       rounded-full shadow-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#466c7e' }}
          >
            <span>🛒</span>
            <span>Cart</span>
            <span className="rounded-full w-6 h-6 flex items-center justify-center
                             text-xs font-bold"
                  style={{ backgroundColor: 'white', color: '#466c7e' }}>
              {totalCartItems}
            </span>
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            ruleBySize={ruleBySize}
            onAddToCart={handleAddToCart}
            cartCounts={cartCounts}
          />
        ))}
      </div>

      <Toast message={toast.message} visible={toast.visible} />
    </>
  )
}
