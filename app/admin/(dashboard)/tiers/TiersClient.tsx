'use client'

import { useState } from 'react'
import type { PartnerTier, TierDiscountRule, Partner, Product } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  initialTiers:    PartnerTier[]
  initialPartners: Partner[]
  initialProducts: Pick<Product, 'id' | 'name' | 'visible_to_tiers'>[]
}

type Size         = '12oz' | '2lb' | '5lb'
type DiscountType = 'none' | 'percentage' | 'amount_per_bag'

interface RuleState {
  type:    DiscountType
  pct:     string
  dollars: string
}

const SIZES: Size[] = ['12oz', '2lb', '5lb']

const EMPTY_RULE_STATE: RuleState = { type: 'none', pct: '0', dollars: '0.00' }

function emptyRules(): Record<Size, RuleState> {
  return { '12oz': { ...EMPTY_RULE_STATE }, '2lb': { ...EMPTY_RULE_STATE }, '5lb': { ...EMPTY_RULE_STATE } }
}

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

function formatRules(rules: TierDiscountRule[]): string {
  if (!rules || rules.length === 0) return 'No discounts'
  return rules
    .map((r) => {
      if (r.discount_type === 'amount_per_bag') {
        return `${r.size}: $${(r.discount_amount_cents / 100).toFixed(2)}/bag`
      }
      return `${r.size}: ${Number(r.discount_pct)}% off`
    })
    .join(' · ')
}

function rulesToState(rules: TierDiscountRule[]): Record<Size, RuleState> {
  const state = emptyRules()
  for (const rule of rules ?? []) {
    const size = rule.size as Size
    if (!SIZES.includes(size)) continue
    state[size] = {
      type:    rule.discount_type,
      pct:     String(Number(rule.discount_pct)),
      dollars: (rule.discount_amount_cents / 100).toFixed(2),
    }
  }
  return state
}

function stateToRules(editRules: Record<Size, RuleState>): Array<{
  size: string; discount_type: string; discount_pct: number; discount_amount_cents: number
}> {
  return SIZES.flatMap((size) => {
    const r = editRules[size]
    if (r.type === 'none') return []
    return [{
      size,
      discount_type:         r.type,
      discount_pct:          r.type === 'percentage' ? Number(r.pct) : 0,
      discount_amount_cents: r.type === 'amount_per_bag' ? Math.round(Number(r.dollars) * 100) : 0,
    }]
  })
}

// ── Section 1: Tier CRUD ───────────────────────────────────────────────────────

function TierSection({
  tiers,
  onTiersChange,
}: {
  tiers: PartnerTier[]
  onTiersChange: (tiers: PartnerTier[]) => void
}) {
  const [name, setName]           = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName]   = useState('')
  const [editRules, setEditRules] = useState<Record<Size, RuleState>>(emptyRules())
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  function updateRule(size: Size, field: keyof RuleState, value: string) {
    setEditRules((prev) => ({ ...prev, [size]: { ...prev[size], [field]: value } }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const created = await apiFetch('/api/tiers', 'POST', { name })
      onTiersChange([...tiers, created].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(tier: PartnerTier) {
    setEditingId(tier.id)
    setEditName(tier.name)
    setEditRules(rulesToState(tier.tier_discount_rules ?? []))
    setError(null)
  }

  async function handleSaveEdit(tierId: number) {
    setSaving(true); setError(null)
    try {
      const [updatedTier, updatedRules] = await Promise.all([
        apiFetch(`/api/tiers/${tierId}`, 'PATCH', { name: editName.trim() }),
        apiFetch(`/api/tiers/${tierId}/discount-rules`, 'PUT', { rules: stateToRules(editRules) }),
      ])
      onTiersChange(
        tiers.map((t) =>
          t.id === tierId ? { ...updatedTier, tier_discount_rules: updatedRules } : t
        )
      )
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
          {tiers.map((tier) =>
            editingId === tier.id ? (
              /* ── Edit mode ── */
              <div key={tier.id} className="px-5 py-4 space-y-4 bg-stone-50">
                {/* Name + actions */}
                <div className="flex items-center gap-3">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    onClick={() => handleSaveEdit(tier.id)}
                    disabled={saving || !editName.trim()}
                    className="text-sm font-medium text-amber-700 hover:text-amber-900 disabled:opacity-50 whitespace-nowrap"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-sm text-stone-400 hover:text-stone-600"
                  >
                    Cancel
                  </button>
                </div>

                {/* Per-size discount rules */}
                <div>
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                    Discounts by Size
                  </p>
                  <div className="border border-stone-200 rounded-lg overflow-hidden bg-white">
                    {SIZES.map((size, i) => (
                      <div
                        key={size}
                        className={`flex items-center gap-3 px-4 py-2.5 ${i < SIZES.length - 1 ? 'border-b border-stone-100' : ''}`}
                      >
                        <span className="w-10 text-sm font-semibold text-stone-600 flex-shrink-0">
                          {size}
                        </span>
                        <select
                          value={editRules[size].type}
                          onChange={(e) => updateRule(size, 'type', e.target.value)}
                          className="border border-stone-300 rounded px-2 py-1 text-sm
                                     focus:outline-none focus:ring-1 focus:ring-amber-400"
                        >
                          <option value="none">No discount</option>
                          <option value="percentage">% off</option>
                          <option value="amount_per_bag">$ off / bag</option>
                        </select>

                        {editRules[size].type === 'percentage' && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number" min="0" max="99.99" step="0.01"
                              value={editRules[size].pct}
                              onChange={(e) => updateRule(size, 'pct', e.target.value)}
                              className="w-16 border border-stone-300 rounded px-2 py-1 text-sm text-center
                                         focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                            <span className="text-stone-500 text-sm">%</span>
                          </div>
                        )}

                        {editRules[size].type === 'amount_per_bag' && (
                          <div className="flex items-center gap-1">
                            <span className="text-stone-500 text-sm">$</span>
                            <input
                              type="number" min="0" step="0.01"
                              value={editRules[size].dollars}
                              onChange={(e) => updateRule(size, 'dollars', e.target.value)}
                              className="w-20 border border-stone-300 rounded px-2 py-1 text-sm text-center
                                         focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                            <span className="text-stone-500 text-sm">/ bag</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {error && <p className="text-red-600 text-sm">{error}</p>}
              </div>
            ) : (
              /* ── Display mode ── */
              <div key={tier.id} className="px-5 py-3 flex items-center gap-3">
                <span className="flex-1 font-medium text-stone-800">{tier.name}</span>
                <span className="text-stone-500 text-sm">
                  {formatRules(tier.tier_discount_rules ?? [])}
                </span>
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
              </div>
            )
          )}
        </div>
      )}

      {/* Create new tier */}
      <form onSubmit={handleCreate} className="px-5 py-4 bg-stone-50 border-t border-stone-100">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">Add Tier</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Tier name (e.g. Premium)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white
                       font-semibold px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
          >
            Add Tier
          </button>
        </div>
        <p className="text-xs text-stone-400 mt-2">
          Set per-size discounts by clicking Edit after creating the tier.
        </p>
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
                    {tier.name}
                    {(tier.tier_discount_rules?.length ?? 0) > 0
                      ? ` (${formatRules(tier.tier_discount_rules!)})`
                      : ' (no discounts)'}
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
    const newValue = updated.length === 0 ? null : updated

    setSavingId(product.id); setError(null)
    try {
      await apiFetch(`/api/products/${product.id}/tiers`, 'PATCH', { visible_to_tiers: newValue })
      onProductsChange(products.map((p) => p.id === product.id ? { ...p, visible_to_tiers: newValue } : p))
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
                  <th key={tier.id} className="px-3 py-3 text-center">{tier.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {products.map((product) => {
                const restricted = product.visible_to_tiers && product.visible_to_tiers.length > 0
                return (
                  <tr key={product.id} className={`hover:bg-stone-50 ${savingId === product.id ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-3 font-medium text-stone-800">{product.name}</td>
                    <td className="px-3 py-3 text-center">
                      {restricted ? (
                        <span className="text-xs text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">Restricted</span>
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
      <TierSection tiers={tiers} onTiersChange={setTiers} />
      <PartnerSection partners={partners} tiers={tiers} onPartnersChange={setPartners} />
      <ProductVisibilitySection products={products} tiers={tiers} onProductsChange={setProducts} />
    </div>
  )
}
