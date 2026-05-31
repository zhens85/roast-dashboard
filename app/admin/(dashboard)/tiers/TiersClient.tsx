'use client'

import { useState } from 'react'
import type { PartnerTier, Partner, Product } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  initialTiers:    PartnerTier[]
  initialPartners: Partner[]
  initialProducts: Pick<Product, 'id' | 'name' | 'visible_to_tiers'>[]
}

type DiscountType = 'percentage' | 'amount_per_bag'

// ── Helpers ────────────────────────────────────────────────────────────────────

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
  return res.json()
}

function formatDiscount(tier: PartnerTier): string {
  if (tier.discount_type === 'amount_per_bag' && tier.discount_amount_cents > 0) {
    return `$${(tier.discount_amount_cents / 100).toFixed(2)} off/bag`
  }
  return Number(tier.discount_pct) > 0
    ? `${Number(tier.discount_pct)}% discount`
    : 'No discount'
}

// ── Section 1: Tier CRUD ───────────────────────────────────────────────────────

function TierSection({
  tiers,
  onTiersChange,
}: {
  tiers: PartnerTier[]
  onTiersChange: (tiers: PartnerTier[]) => void
}) {
  const [name, setName]                             = useState('')
  const [discountType, setDiscountType]             = useState<DiscountType>('percentage')
  const [discountPct, setDiscountPct]               = useState('0')
  const [discountAmountDollars, setDiscountAmountDollars] = useState('0.00')
  const [editingId, setEditingId]                   = useState<number | null>(null)
  const [editName, setEditName]                     = useState('')
  const [editDiscountType, setEditDiscountType]     = useState<DiscountType>('percentage')
  const [editDiscount, setEditDiscount]             = useState('')
  const [editDiscountAmount, setEditDiscountAmount] = useState('0.00')
  const [saving, setSaving]                         = useState(false)
  const [error, setError]                           = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const created = await apiFetch('/api/tiers', 'POST', {
        name,
        discount_type:         discountType,
        discount_pct:          discountType === 'percentage' ? Number(discountPct) : 0,
        discount_amount_cents: discountType === 'amount_per_bag'
          ? Math.round(Number(discountAmountDollars) * 100)
          : 0,
      })
      onTiersChange([...tiers, created].sort((a, b) => a.name.localeCompare(b.name)))
      setName(''); setDiscountType('percentage'); setDiscountPct('0'); setDiscountAmountDollars('0.00')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(tier: PartnerTier) {
    setEditingId(tier.id)
    setEditName(tier.name)
    setEditDiscountType(tier.discount_type ?? 'percentage')
    setEditDiscount(String(Number(tier.discount_pct)))
    setEditDiscountAmount(((tier.discount_amount_cents ?? 0) / 100).toFixed(2))
  }

  async function handleSaveEdit(tierId: number) {
    setSaving(true); setError(null)
    try {
      const updated = await apiFetch(`/api/tiers/${tierId}`, 'PATCH', {
        name:                  editName.trim(),
        discount_type:         editDiscountType,
        discount_pct:          editDiscountType === 'percentage' ? Number(editDiscount) : 0,
        discount_amount_cents: editDiscountType === 'amount_per_bag'
          ? Math.round(Number(editDiscountAmount) * 100)
          : 0,
      })
      onTiersChange(tiers.map((t) => (t.id === tierId ? updated : t)))
      setEditingId(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(tierId: number, tierName: string) {
    if (!confirm(`Delete tier "${tierName}"? Partners in this tier will become untiered.`)) return
    setSaving(true); setError(null)
    try {
      await apiFetch(`/api/tiers/${tierId}`, 'DELETE')
      onTiersChange(tiers.filter((t) => t.id !== tierId))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-white rounded-lg border border-stone-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100">
        <h2 className="font-semibold text-stone-800 text-lg">Tiers</h2>
      </div>

      {/* Existing tiers */}
      {tiers.length > 0 && (
        <div className="divide-y divide-stone-100">
          {tiers.map((tier) => (
            <div key={tier.id} className="px-5 py-3 flex items-center gap-3">
              {editingId === tier.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 border border-stone-300 rounded px-2 py-1 text-sm
                               focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  {/* Discount type toggle */}
                  <select
                    value={editDiscountType}
                    onChange={(e) => setEditDiscountType(e.target.value as DiscountType)}
                    className="border border-stone-300 rounded px-2 py-1 text-sm
                               focus:outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="percentage">% off</option>
                    <option value="amount_per_bag">$ off/bag</option>
                  </select>
                  {/* Discount value */}
                  {editDiscountType === 'percentage' ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="99.99"
                        step="0.01"
                        value={editDiscount}
                        onChange={(e) => setEditDiscount(e.target.value)}
                        className="w-16 border border-stone-300 rounded px-2 py-1 text-sm text-center
                                   focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                      <span className="text-stone-500 text-sm">%</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-stone-500 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editDiscountAmount}
                        onChange={(e) => setEditDiscountAmount(e.target.value)}
                        className="w-20 border border-stone-300 rounded px-2 py-1 text-sm text-center
                                   focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                      <span className="text-stone-500 text-sm">/bag</span>
                    </div>
                  )}
                  <button
                    onClick={() => handleSaveEdit(tier.id)}
                    disabled={saving}
                    className="text-sm font-medium text-amber-700 hover:text-amber-900 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-sm text-stone-400 hover:text-stone-600"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium text-stone-800">{tier.name}</span>
                  <span className="text-stone-500 text-sm">{formatDiscount(tier)}</span>
                  <button
                    onClick={() => startEdit(tier)}
                    className="text-xs text-stone-400 hover:text-stone-700 underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(tier.id, tier.name)}
                    disabled={saving}
                    className="text-xs text-red-400 hover:text-red-600 underline disabled:opacity-50"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create new tier */}
      <form onSubmit={handleCreate} className="px-5 py-4 bg-stone-50 border-t border-stone-100">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">Add Tier</p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Tier name (e.g. Premium)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="flex-1 min-w-40 border border-stone-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {/* Discount type */}
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as DiscountType)}
            className="border border-stone-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="percentage">% off</option>
            <option value="amount_per_bag">$ off/bag</option>
          </select>
          {/* Discount value */}
          {discountType === 'percentage' ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="99.99"
                step="0.01"
                placeholder="0"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                className="w-20 border border-stone-300 rounded-lg px-3 py-2 text-sm text-center
                           focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <span className="text-stone-500 text-sm">% off</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-stone-500 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={discountAmountDollars}
                onChange={(e) => setDiscountAmountDollars(e.target.value)}
                className="w-20 border border-stone-300 rounded-lg px-3 py-2 text-sm text-center
                           focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <span className="text-stone-500 text-sm">off/bag</span>
            </div>
          )}
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white
                       font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Add Tier
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </form>
    </section>
  )
}

// ── Section 2: Partner tier assignment ─────────────────────────────────────────

function PartnerSection({
  partners,
  tiers,
  onPartnersChange,
}: {
  partners: Partner[]
  tiers: PartnerTier[]
  onPartnersChange: (partners: Partner[]) => void
}) {
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)

  async function handleTierChange(partnerId: string, tierIdStr: string) {
    const tierId = tierIdStr === '' ? null : Number(tierIdStr)
    setSavingId(partnerId); setError(null)
    try {
      await apiFetch(`/api/partners/${partnerId}/tier`, 'PATCH', { tier_id: tierId })
      onPartnersChange(
        partners.map((p) =>
          p.id === partnerId
            ? { ...p, tier_id: tierId, partner_tiers: tiers.find((t) => t.id === tierId) ?? null }
            : p
        )
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="bg-white rounded-lg border border-stone-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100">
        <h2 className="font-semibold text-stone-800 text-lg">Partner Assignments</h2>
        <p className="text-stone-500 text-sm mt-0.5">
          Partners with no tier see all products at full price.
        </p>
      </div>

      {partners.length === 0 ? (
        <div className="px-5 py-8 text-center text-stone-400 text-sm">No partners yet.</div>
      ) : (
        <div className="divide-y divide-stone-100">
          {partners.map((partner) => (
            <div key={partner.id} className="px-5 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-800 truncate">{partner.company_name}</p>
                <p className="text-xs text-stone-400 truncate">{partner.contact_person}</p>
              </div>

              <select
                value={partner.tier_id ?? ''}
                onChange={(e) => handleTierChange(partner.id, e.target.value)}
                disabled={savingId === partner.id}
                className="border border-stone-300 rounded-lg px-2 py-1.5 text-sm text-stone-700
                           focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
              >
                <option value="">No tier</option>
                {tiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name} ({formatDiscount(tier)})
                  </option>
                ))}
              </select>

              {savingId === partner.id && (
                <span className="text-xs text-stone-400">Saving…</span>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="px-5 py-3 bg-red-50 border-t border-red-100">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
    </section>
  )
}

// ── Section 3: Product visibility matrix ───────────────────────────────────────

function ProductVisibilitySection({
  products,
  tiers,
  onProductsChange,
}: {
  products: Pick<Product, 'id' | 'name' | 'visible_to_tiers'>[]
  tiers: PartnerTier[]
  onProductsChange: (products: Pick<Product, 'id' | 'name' | 'visible_to_tiers'>[]) => void
}) {
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError]       = useState<string | null>(null)

  async function handleCheckChange(product: Pick<Product, 'id' | 'name' | 'visible_to_tiers'>, tierId: number, checked: boolean) {
    const current = product.visible_to_tiers ?? []
    const updated = checked
      ? [...new Set([...current, tierId])]
      : current.filter((id) => id !== tierId)

    // Empty array → null (visible to all)
    const newValue = updated.length === 0 ? null : updated

    setSavingId(product.id); setError(null)
    try {
      await apiFetch(`/api/products/${product.id}/tiers`, 'PATCH', {
        visible_to_tiers: newValue,
      })
      onProductsChange(
        products.map((p) =>
          p.id === product.id ? { ...p, visible_to_tiers: newValue } : p
        )
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSavingId(null)
    }
  }

  if (tiers.length === 0) {
    return (
      <section className="bg-white rounded-lg border border-stone-200 p-8 text-center text-stone-400 text-sm">
        Create at least one tier above to manage product visibility.
      </section>
    )
  }

  return (
    <section className="bg-white rounded-lg border border-stone-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100">
        <h2 className="font-semibold text-stone-800 text-lg">Product Visibility</h2>
        <p className="text-stone-500 text-sm mt-0.5">
          Check the tiers that can see each product. Unchecked = visible to all tiers.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="px-5 py-8 text-center text-stone-400 text-sm">No active products.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-3">Product</th>
                <th className="text-center px-3 py-3 text-xs text-stone-400 font-normal italic">
                  Restricted to:
                </th>
                {tiers.map((tier) => (
                  <th key={tier.id} className="px-3 py-3 text-center">
                    {tier.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {products.map((product) => {
                const restricted = product.visible_to_tiers && product.visible_to_tiers.length > 0
                return (
                  <tr
                    key={product.id}
                    className={`hover:bg-stone-50 ${savingId === product.id ? 'opacity-60' : ''}`}
                  >
                    <td className="px-5 py-3 font-medium text-stone-800">{product.name}</td>
                    <td className="px-3 py-3 text-center">
                      {restricted ? (
                        <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                          Restricted
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">All</span>
                      )}
                    </td>
                    {tiers.map((tier) => (
                      <td key={tier.id} className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={(product.visible_to_tiers ?? []).includes(tier.id)}
                          onChange={(e) => handleCheckChange(product, tier.id, e.target.checked)}
                          disabled={savingId === product.id}
                          className="h-4 w-4 accent-amber-600 cursor-pointer disabled:cursor-wait"
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <div className="px-5 py-3 bg-red-50 border-t border-red-100">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
    </section>
  )
}

// ── TiersClient (main export) ─────────────────────────────────────────────────

export default function TiersClient({ initialTiers, initialPartners, initialProducts }: Props) {
  const [tiers, setTiers]       = useState<PartnerTier[]>(initialTiers)
  const [partners, setPartners] = useState<Partner[]>(initialPartners)
  const [products, setProducts] = useState<Pick<Product, 'id' | 'name' | 'visible_to_tiers'>[]>(initialProducts)

  return (
    <div className="space-y-6 pb-10">
      <TierSection
        tiers={tiers}
        onTiersChange={setTiers}
      />
      <PartnerSection
        partners={partners}
        tiers={tiers}
        onPartnersChange={setPartners}
      />
      <ProductVisibilitySection
        products={products}
        tiers={tiers}
        onProductsChange={setProducts}
      />
    </div>
  )
}
