'use client'

import { useState } from 'react'
import type { Product, ProductVariant, ProductAlias } from '@/types'
import type { ProductWithVariants } from './page'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body:    body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? 'Request failed')
  }
  // 204 No Content — nothing to parse
  if (res.status === 204) return null
  return res.json()
}

function fmtPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function dollarsToCents(val: string): number {
  return Math.round(parseFloat(val) * 100)
}

const ROAST_LEVELS = ['light', 'medium', 'medium-dark', 'dark'] as const
const SIZES        = ['12oz', '2lb', '5lb'] as const

// ── Alias state helpers ───────────────────────────────────────────────────────

// alias_product_id → canonical_product_id (simple ID lookup)
type AliasIdMap = Record<number, number>

function buildAliasIdMap(
  aliases: Pick<ProductAlias, 'alias_product_id' | 'canonical_product_id'>[]
): AliasIdMap {
  return Object.fromEntries(aliases.map((a) => [a.alias_product_id, a.canonical_product_id]))
}

// ── Empty product form state ──────────────────────────────────────────────────

interface ProductForm {
  name:              string
  description:       string
  origin_region:     string
  roast_level:       string
  process_method:    string
  image_url:         string
  roast_loss_factor: string
  is_active:         boolean
}

const EMPTY_FORM: ProductForm = {
  name:              '',
  description:       '',
  origin_region:     '',
  roast_level:       '',
  process_method:    '',
  image_url:         '',
  roast_loss_factor: '0.15',
  is_active:         true,
}

// ── Alias Section ─────────────────────────────────────────────────────────────
// Shown inside an expanded product row. Lets admins map this product to a
// canonical roast product (or clear an existing mapping).

function AliasSection({
  product,
  allProducts,
  aliasIdMap,
  onAliasChange,
}: {
  product:       ProductWithVariants
  allProducts:   ProductWithVariants[]
  aliasIdMap:    AliasIdMap
  onAliasChange: (aliasProductId: number, canonicalProductId: number | null) => void
}) {
  const currentCanonicalId = aliasIdMap[product.id] ?? null

  // Products that alias TO this product (i.e., this product is the canonical target)
  const inboundAliases = allProducts.filter((p) => aliasIdMap[p.id] === product.id)

  // Dropdown options: all other products that are not themselves aliases
  // (we only allow one level of aliasing)
  const eligibleCanonicals = allProducts.filter(
    (p) => p.id !== product.id && aliasIdMap[p.id] === undefined
  )

  const [editing,   setEditing]   = useState(false)
  const [selected,  setSelected]  = useState<string>(String(currentCanonicalId ?? ''))
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const currentCanonicalName = currentCanonicalId
    ? allProducts.find((p) => p.id === currentCanonicalId)?.name
    : null

  async function handleSave() {
    const canonicalId = parseInt(selected, 10)
    if (isNaN(canonicalId)) { setError('Please select a product'); return }
    setSaving(true); setError(null)
    try {
      await apiFetch(`/api/products/${product.id}/alias`, 'PUT', {
        canonical_product_id: canonicalId,
      })
      onAliasChange(product.id, canonicalId)
      setEditing(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    if (!confirm(`Remove the alias mapping for "${product.name}"? It will become a standalone product.`)) return
    setSaving(true); setError(null)
    try {
      await apiFetch(`/api/products/${product.id}/alias`, 'DELETE')
      onAliasChange(product.id, null)
      setEditing(false)
      setSelected('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function startEditing() {
    setSelected(String(currentCanonicalId ?? eligibleCanonicals[0]?.id ?? ''))
    setError(null)
    setEditing(true)
  }

  return (
    <div className="mt-4 pt-4 border-t border-stone-100">
      <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">
        Roast Alias
      </p>

      {/* This product is a canonical target — show inbound aliases, no edit */}
      {inboundAliases.length > 0 && !currentCanonicalId && (
        <div className="text-sm text-stone-600">
          <span className="font-medium">{inboundAliases.length}</span>{' '}
          product{inboundAliases.length !== 1 ? 's' : ''} roast as this coffee:
          <ul className="mt-1 ml-3 space-y-0.5">
            {inboundAliases.map((p) => (
              <li key={p.id} className="text-stone-500 text-xs">
                • {p.name}
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-400 italic mt-2">
            This product is a canonical roast target and cannot itself be aliased.
          </p>
        </div>
      )}

      {/* Standalone product with no aliases in either direction */}
      {inboundAliases.length === 0 && !currentCanonicalId && !editing && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-stone-400 italic">Standalone — roasted independently</span>
          {eligibleCanonicals.length > 0 && (
            <button
              onClick={startEditing}
              className="text-xs text-stone-400 hover:text-stone-700 underline"
            >
              Set alias
            </button>
          )}
        </div>
      )}

      {/* Has an existing alias mapping — show it */}
      {currentCanonicalId && !editing && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-stone-500">Roasted as</span>
            <span
              className="font-semibold px-2 py-0.5 rounded-full text-xs"
              style={{ backgroundColor: '#eaf1f4', color: '#466c7e' }}
            >
              {currentCanonicalName ?? `Product #${currentCanonicalId}`}
            </span>
          </div>
          <button
            onClick={startEditing}
            disabled={saving}
            className="text-xs text-stone-400 hover:text-stone-700 underline disabled:opacity-50"
          >
            Change
          </button>
          <button
            onClick={handleClear}
            disabled={saving}
            className="text-xs text-red-400 hover:text-red-600 underline disabled:opacity-50"
          >
            {saving ? 'Removing…' : 'Remove alias'}
          </button>
        </div>
      )}

      {/* Editing alias */}
      {editing && (
        <div className="space-y-2">
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Roasted as</label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="border border-stone-300 rounded px-2 py-1.5 text-sm min-w-48
                           focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                <option value="">— Select a product —</option>
                {eligibleCanonicals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.roast_level ? ` (${p.roast_level})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !selected}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white
                         text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save Alias'}
            </button>
            <button
              onClick={() => { setEditing(false); setError(null) }}
              disabled={saving}
              className="text-sm text-stone-500 hover:text-stone-700 px-2 py-1.5"
            >
              Cancel
            </button>
            {currentCanonicalId && (
              <button
                onClick={handleClear}
                disabled={saving}
                className="text-xs text-red-400 hover:text-red-600 underline disabled:opacity-50 ml-1"
              >
                Remove alias
              </button>
            )}
          </div>
          <p className="text-xs text-stone-400">
            On the roast schedule this product will be merged with the selected coffee.
            The pick list will still show <span className="font-medium">"{product.name}"</span>.
          </p>
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
      )}
    </div>
  )
}

// ── Add Variant Form ──────────────────────────────────────────────────────────

function AddVariantForm({
  productId,
  existingSizes,
  onAdded,
}: {
  productId:     number
  existingSizes: string[]
  onAdded:       (variant: ProductVariant) => void
}) {
  const availableSizes = SIZES.filter((s) => !existingSizes.includes(s))
  const [size,   setSize]   = useState<'12oz' | '2lb' | '5lb'>(availableSizes[0] ?? '12oz')
  const [price,  setPrice]  = useState('')
  const [sku,    setSku]    = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  if (availableSizes.length === 0) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!price || !sku.trim()) { setError('Price and SKU are required'); return }
    setSaving(true); setError(null)
    try {
      const variant = await apiFetch('/api/variants', 'POST', {
        product_id:   productId,
        size,
        price_cents:  dollarsToCents(price),
        sku:          sku.trim().toUpperCase(),
        is_available: true,
      })
      onAdded(variant)
      setPrice(''); setSku('')
      setSize(availableSizes.find((s) => s !== size) ?? availableSizes[0])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end mt-3 pt-3 border-t border-stone-100">
      <div>
        <label className="block text-xs text-stone-500 mb-1">Size</label>
        <select
          value={size}
          onChange={(e) => setSize(e.target.value as '12oz' | '2lb' | '5lb')}
          className="border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
        >
          {availableSizes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-stone-500 mb-1">Price</label>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="border border-stone-300 rounded pl-5 pr-2 py-1.5 text-sm w-24
                       focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-stone-500 mb-1">SKU</label>
        <input
          type="text"
          placeholder="ETH-YIR-12OZ"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="border border-stone-300 rounded px-2 py-1.5 text-sm w-32 uppercase
                     focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="bg-stone-700 hover:bg-stone-800 disabled:opacity-50 text-white
                   text-sm font-medium px-3 py-1.5 rounded transition-colors"
      >
        + Add Size
      </button>
      {error && <p className="text-red-600 text-xs w-full">{error}</p>}
    </form>
  )
}

// ── Variant Row ───────────────────────────────────────────────────────────────

function VariantRow({
  variant,
  onUpdate,
  onDelete,
}: {
  variant:  ProductVariant
  onUpdate: (v: ProductVariant) => void
  onDelete: (id: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [price,   setPrice]   = useState((variant.price_cents / 100).toFixed(2))
  const [sku,     setSku]     = useState(variant.sku)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const updated = await apiFetch(`/api/variants/${variant.id}`, 'PATCH', {
        price_cents: dollarsToCents(price),
        sku:         sku.trim().toUpperCase(),
      })
      onUpdate(updated)
      setEditing(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleAvailable() {
    setSaving(true)
    try {
      const updated = await apiFetch(`/api/variants/${variant.id}`, 'PATCH', {
        is_available: !variant.is_available,
      })
      onUpdate(updated)
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete the ${variant.size} variant (${variant.sku})?`)) return
    setSaving(true)
    try {
      await apiFetch(`/api/variants/${variant.id}`, 'DELETE')
      onDelete(variant.id)
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className={`flex items-center gap-3 py-2 ${saving ? 'opacity-60' : ''}`}>
      <span className="text-xs font-semibold bg-stone-100 text-stone-600 rounded px-2 py-0.5 w-10 text-center flex-shrink-0">
        {variant.size}
      </span>

      {editing ? (
        <>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 text-xs">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="border border-stone-300 rounded pl-4 pr-2 py-1 text-sm w-20
                         focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="border border-stone-300 rounded px-2 py-1 text-sm w-28 uppercase
                       focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <button onClick={handleSave} disabled={saving}
            className="text-xs font-medium text-amber-700 hover:text-amber-900 disabled:opacity-50">
            Save
          </button>
          <button onClick={() => setEditing(false)}
            className="text-xs text-stone-400 hover:text-stone-600">
            Cancel
          </button>
        </>
      ) : (
        <>
          <span className="text-sm font-medium text-stone-800 w-16">{fmtPrice(variant.price_cents)}</span>
          <span className="text-xs text-stone-400 font-mono">{variant.sku}</span>
          <button onClick={toggleAvailable} disabled={saving}
            className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors
              ${variant.is_available
                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
            {variant.is_available ? 'Available' : 'Unavailable'}
          </button>
          <button onClick={() => setEditing(true)}
            className="text-xs text-stone-400 hover:text-stone-700 underline ml-auto">
            Edit
          </button>
          <button onClick={handleDelete} disabled={saving}
            className="text-xs text-red-400 hover:text-red-600 underline">
            Delete
          </button>
        </>
      )}
      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  )
}

// ── Product Row ───────────────────────────────────────────────────────────────

function ProductRow({
  product,
  allProducts,
  aliasIdMap,
  onUpdate,
  onDelete,
  onAliasChange,
}: {
  product:       ProductWithVariants
  allProducts:   ProductWithVariants[]
  aliasIdMap:    AliasIdMap
  onUpdate:      (p: ProductWithVariants) => void
  onDelete:      (id: number) => void
  onAliasChange: (aliasProductId: number, canonicalProductId: number | null) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing,  setEditing]  = useState(false)
  const [form,     setForm]     = useState<ProductForm>({
    name:              product.name,
    description:       product.description       ?? '',
    origin_region:     product.origin_region      ?? '',
    roast_level:       product.roast_level        ?? '',
    process_method:    product.process_method     ?? '',
    image_url:         product.image_url          ?? '',
    roast_loss_factor: String(product.roast_loss_factor ?? 0.15),
    is_active:         product.is_active,
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const sortedVariants = [...product.product_variants].sort((a, b) => {
    const order = { '12oz': 0, '2lb': 1, '5lb': 2 }
    return (order[a.size as keyof typeof order] ?? 0) - (order[b.size as keyof typeof order] ?? 0)
  })

  const canonicalId   = aliasIdMap[product.id] ?? null
  const canonicalName = canonicalId
    ? allProducts.find((p) => p.id === canonicalId)?.name
    : null

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const updated = await apiFetch(`/api/products/${product.id}`, 'PATCH', {
        name:              form.name.trim(),
        description:       form.description    || null,
        origin_region:     form.origin_region  || null,
        roast_level:       form.roast_level    || null,
        process_method:    form.process_method || null,
        image_url:         form.image_url      || null,
        roast_loss_factor: parseFloat(form.roast_loss_factor),
        is_active:         form.is_active,
      })
      onUpdate({ ...updated, product_variants: product.product_variants })
      setEditing(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive() {
    setSaving(true)
    try {
      const updated = await apiFetch(`/api/products/${product.id}`, 'PATCH', {
        is_active: !product.is_active,
      })
      onUpdate({ ...updated, product_variants: product.product_variants })
      setForm((f) => ({ ...f, is_active: updated.is_active }))
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  function handleVariantUpdate(updated: ProductVariant) {
    onUpdate({
      ...product,
      product_variants: product.product_variants.map((v) =>
        v.id === updated.id ? updated : v
      ),
    })
  }

  function handleVariantDelete(variantId: number) {
    onUpdate({
      ...product,
      product_variants: product.product_variants.filter((v) => v.id !== variantId),
    })
  }

  function handleVariantAdded(variant: ProductVariant) {
    onUpdate({
      ...product,
      product_variants: [...product.product_variants, variant],
    })
  }

  return (
    <div className={`bg-white rounded-lg border transition-colors
                     ${product.is_active ? 'border-stone-200' : 'border-stone-200 opacity-60'}`}>
      {/* Product header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-stone-400 hover:text-stone-700 flex-shrink-0 w-5 text-center"
        >
          {expanded ? '▾' : '▸'}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-stone-900">{product.name}</span>
            {product.roast_level && (
              <span className="text-xs bg-stone-100 text-stone-500 rounded-full px-2 py-0.5 capitalize">
                {product.roast_level}
              </span>
            )}
            {product.origin_region && (
              <span className="text-xs text-stone-400">{product.origin_region}</span>
            )}
            {/* Alias badge */}
            {canonicalName && (
              <span
                className="text-xs rounded-full px-2 py-0.5 font-medium"
                style={{ backgroundColor: '#eaf1f4', color: '#466c7e' }}
              >
                → {canonicalName}
              </span>
            )}
            {!product.is_active && (
              <span className="text-xs bg-red-50 text-red-500 rounded-full px-2 py-0.5">Inactive</span>
            )}
          </div>
          <div className="flex gap-3 mt-0.5">
            {sortedVariants.map((v) => (
              <span key={v.id} className="text-xs text-stone-500">
                {v.size}: {fmtPrice(v.price_cents)}
              </span>
            ))}
            {sortedVariants.length === 0 && (
              <span className="text-xs text-amber-600 italic">No variants — click to add</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={toggleActive}
            disabled={saving}
            className={`text-xs px-2 py-1 rounded-full font-medium transition-colors disabled:opacity-50
              ${product.is_active
                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
          >
            {product.is_active ? 'Active' : 'Inactive'}
          </button>
          <button
            onClick={() => { setEditing((e) => !e); setExpanded(true) }}
            className="text-xs text-stone-400 hover:text-stone-700 underline"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Expanded: edit form + variants + alias */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-stone-100">
          {editing && (
            <div className="py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-stone-100 mb-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-500 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                             focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Origin Region</label>
                <input
                  type="text"
                  value={form.origin_region}
                  onChange={(e) => setForm((f) => ({ ...f, origin_region: e.target.value }))}
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                             focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Roast Level</label>
                <select
                  value={form.roast_level}
                  onChange={(e) => setForm((f) => ({ ...f, roast_level: e.target.value }))}
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                             focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  <option value="">— None —</option>
                  {ROAST_LEVELS.map((l) => (
                    <option key={l} value={l} className="capitalize">{l}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Process Method</label>
                <input
                  type="text"
                  value={form.process_method}
                  onChange={(e) => setForm((f) => ({ ...f, process_method: e.target.value }))}
                  placeholder="Washed, Natural, Honey…"
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                             focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">
                  Roast Loss Factor
                  <span className="text-stone-400 font-normal ml-1">(0.00–0.99)</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  max="0.99"
                  step="0.001"
                  value={form.roast_loss_factor}
                  onChange={(e) => setForm((f) => ({ ...f, roast_loss_factor: e.target.value }))}
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                             focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-500 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm resize-none
                             focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-500 mb-1">Image URL</label>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://…"
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                             focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              {error && <p className="text-red-600 text-xs sm:col-span-2">{error}</p>}

              <div className="sm:col-span-2 flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white
                             text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-sm text-stone-500 hover:text-stone-700 px-3 py-1.5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Variants */}
          <div className="mt-2">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">Sizes & Pricing</p>
            {sortedVariants.length === 0 && (
              <p className="text-sm text-stone-400 italic">No sizes yet.</p>
            )}
            <div className="divide-y divide-stone-50">
              {sortedVariants.map((v) => (
                <VariantRow
                  key={v.id}
                  variant={v}
                  onUpdate={handleVariantUpdate}
                  onDelete={handleVariantDelete}
                />
              ))}
            </div>
            <AddVariantForm
              productId={product.id}
              existingSizes={sortedVariants.map((v) => v.size)}
              onAdded={handleVariantAdded}
            />
          </div>

          {/* Alias management */}
          <AliasSection
            product={product}
            allProducts={allProducts}
            aliasIdMap={aliasIdMap}
            onAliasChange={onAliasChange}
          />
        </div>
      )}
    </div>
  )
}

// ── Add Product Form ──────────────────────────────────────────────────────────

function AddProductForm({ onAdded }: { onAdded: (p: ProductWithVariants) => void }) {
  const [open,   setOpen]   = useState(false)
  const [form,   setForm]   = useState<ProductForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    try {
      const created = await apiFetch('/api/products', 'POST', {
        name:              form.name.trim(),
        description:       form.description    || null,
        origin_region:     form.origin_region  || null,
        roast_level:       form.roast_level    || null,
        process_method:    form.process_method || null,
        image_url:         form.image_url      || null,
        roast_loss_factor: parseFloat(form.roast_loss_factor),
        is_active:         form.is_active,
      })
      onAdded({ ...created, product_variants: [] })
      setForm(EMPTY_FORM)
      setOpen(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full border-2 border-dashed border-stone-300 hover:border-amber-400
                   text-stone-500 hover:text-amber-700 rounded-lg py-3 text-sm font-medium
                   transition-colors"
      >
        + Add New Product
      </button>
    )
  }

  return (
    <div className="bg-white rounded-lg border-2 border-amber-400 p-5">
      <h3 className="font-semibold text-stone-800 mb-4">New Product</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-stone-500 mb-1">Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
            required
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Origin Region</label>
          <input
            type="text"
            value={form.origin_region}
            onChange={(e) => setForm((f) => ({ ...f, origin_region: e.target.value }))}
            placeholder="Ethiopia, Colombia…"
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Roast Level</label>
          <select
            value={form.roast_level}
            onChange={(e) => setForm((f) => ({ ...f, roast_level: e.target.value }))}
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="">— None —</option>
            {ROAST_LEVELS.map((l) => (
              <option key={l} value={l} className="capitalize">{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Process Method</label>
          <input
            type="text"
            value={form.process_method}
            onChange={(e) => setForm((f) => ({ ...f, process_method: e.target.value }))}
            placeholder="Washed, Natural, Honey…"
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">
            Roast Loss Factor
            <span className="text-stone-400 font-normal ml-1">(default 0.15)</span>
          </label>
          <input
            type="number"
            min="0.01"
            max="0.99"
            step="0.001"
            value={form.roast_loss_factor}
            onChange={(e) => setForm((f) => ({ ...f, roast_loss_factor: e.target.value }))}
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-stone-500 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm resize-none
                       focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-stone-500 mb-1">Image URL</label>
          <input
            type="url"
            value={form.image_url}
            onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            placeholder="https://…"
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        {error && <p className="text-red-600 text-xs sm:col-span-2">{error}</p>}

        <div className="sm:col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white
                       text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Creating…' : 'Create Product'}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setForm(EMPTY_FORM); setError(null) }}
            className="text-sm text-stone-500 hover:text-stone-700 px-3 py-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ── ProductsClient (main export) ──────────────────────────────────────────────

interface ProductsClientProps {
  initialProducts: ProductWithVariants[]
  initialAliases:  Pick<ProductAlias, 'alias_product_id' | 'canonical_product_id'>[]
}

export default function ProductsClient({ initialProducts, initialAliases }: ProductsClientProps) {
  const [products,  setProducts]  = useState<ProductWithVariants[]>(initialProducts)
  const [aliasIdMap, setAliasIdMap] = useState<AliasIdMap>(() => buildAliasIdMap(initialAliases))
  const [showInactive, setShowInactive] = useState(false)

  const active   = products.filter((p) => p.is_active)
  const inactive = products.filter((p) => !p.is_active)
  const visible  = showInactive ? products : active

  function handleUpdate(updated: ProductWithVariants) {
    setProducts((prev) => prev.map((p) => p.id === updated.id ? updated : p))
  }

  function handleDelete(id: number) {
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, is_active: false } : p))
  }

  function handleAdded(product: ProductWithVariants) {
    setProducts((prev) => [...prev, product].sort((a, b) => a.name.localeCompare(b.name)))
  }

  function handleAliasChange(aliasProductId: number, canonicalProductId: number | null) {
    setAliasIdMap((prev) => {
      const next = { ...prev }
      if (canonicalProductId === null) {
        delete next[aliasProductId]
      } else {
        next[aliasProductId] = canonicalProductId
      }
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">
          {active.length} active product{active.length !== 1 ? 's' : ''}
          {inactive.length > 0 && `, ${inactive.length} inactive`}
        </p>
        {inactive.length > 0 && (
          <button
            onClick={() => setShowInactive((s) => !s)}
            className="text-sm text-stone-400 hover:text-stone-700 underline"
          >
            {showInactive ? 'Hide inactive' : 'Show inactive'}
          </button>
        )}
      </div>

      {visible.map((product) => (
        <ProductRow
          key={product.id}
          product={product}
          allProducts={products}
          aliasIdMap={aliasIdMap}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onAliasChange={handleAliasChange}
        />
      ))}

      {visible.length === 0 && (
        <div className="bg-white rounded-lg border border-stone-200 p-10 text-center text-stone-400 text-sm">
          No products yet. Add your first one below.
        </div>
      )}

      <AddProductForm onAdded={handleAdded} />
    </div>
  )
}
