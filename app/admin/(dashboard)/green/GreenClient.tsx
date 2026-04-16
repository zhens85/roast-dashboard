'use client'

import { useState, useEffect } from 'react'
import type { GreenLot, GreenLotTransaction, BlendRecipe, BlendRecipeItem, Product } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? 'Request failed')
  }
  if (res.status === 204) return null
  return res.json()
}

function fmtLbs(n: number | string): string {
  return `${Number(n).toFixed(1)} lbs`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function pctLeft(lot: GreenLot): number {
  const initial = Number(lot.initial_weight_lbs)
  if (!initial) return 0
  return Math.max(0, Math.min(100, (Number(lot.total_weight_lbs) / initial) * 100))
}

function pctColor(pct: number): string {
  if (pct > 50) return '#16a34a'   // green-600
  if (pct > 20) return '#ca8a04'   // yellow-600
  return '#d60000'                  // red
}

// ── Add Lot Form ──────────────────────────────────────────────────────────────

interface LotForm {
  name: string
  origin: string
  producer: string
  harvest_year: string
  process: string
  location: string
  origin_warehouse: string
  bag_count: string
  bag_weight_lbs: string
  price_per_lb: string
  notes: string
}

const EMPTY_LOT_FORM: LotForm = {
  name: '',
  origin: '',
  producer: '',
  harvest_year: '',
  process: '',
  location: 'Roastery',
  origin_warehouse: '',
  bag_count: '',
  bag_weight_lbs: '',
  price_per_lb: '',
  notes: '',
}

function AddLotForm({ onAdded }: { onAdded: (lot: GreenLot) => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<LotForm>(EMPTY_LOT_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bags = parseInt(form.bag_count, 10) || 0
  const bagWt = parseFloat(form.bag_weight_lbs) || 0
  const totalWt = bags * bagWt

  function set(key: keyof LotForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.origin.trim()) { setError('Origin is required'); return }
    if (bags <= 0) { setError('Number of bags must be > 0'); return }
    if (bagWt <= 0) { setError('Weight per bag must be > 0'); return }

    setSaving(true)
    setError(null)
    try {
      const created = await apiFetch('/api/green/lots', 'POST', {
        name:             form.name.trim(),
        origin:           form.origin.trim(),
        producer:         form.producer.trim() || null,
        harvest_year:     form.harvest_year.trim() || null,
        process:          form.process.trim() || null,
        location:         form.location.trim() || 'Roastery',
        origin_warehouse: form.origin_warehouse.trim() || null,
        bag_count:        bags,
        bag_weight_lbs:   bagWt,
        price_per_lb:     form.price_per_lb ? parseFloat(form.price_per_lb) : null,
        notes:            form.notes.trim() || null,
      })
      onAdded(created)
      setForm(EMPTY_LOT_FORM)
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
        className="text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        style={{ backgroundColor: '#466c7e' }}
      >
        + Add Lot
      </button>
    )
  }

  return (
    <div
      className="bg-white rounded-xl border p-5 mb-4"
      style={{ borderColor: '#466c7e', borderWidth: 2 }}
    >
      <h3 className="font-semibold mb-4" style={{ color: '#3b4858' }}>New Green Lot</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

        {/* Name — full width */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>
            Name <span style={{ color: '#d60000' }}>*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={set('name')}
            autoFocus
            placeholder="Colombia Huila - ASMUCAFE 2025"
            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: '#e5e5e5' }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>
            Origin <span style={{ color: '#d60000' }}>*</span>
          </label>
          <input
            type="text"
            value={form.origin}
            onChange={set('origin')}
            placeholder="Colombia"
            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: '#e5e5e5' }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Producer</label>
          <input
            type="text"
            value={form.producer}
            onChange={set('producer')}
            placeholder="ASMUCAFE"
            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: '#e5e5e5' }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Harvest Year</label>
          <input
            type="text"
            value={form.harvest_year}
            onChange={set('harvest_year')}
            placeholder="2025"
            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: '#e5e5e5' }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Process</label>
          <input
            type="text"
            value={form.process}
            onChange={set('process')}
            placeholder="Washed, Natural, Honey…"
            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: '#e5e5e5' }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Location</label>
          <input
            type="text"
            value={form.location}
            onChange={set('location')}
            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: '#e5e5e5' }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Origin Warehouse</label>
          <input
            type="text"
            value={form.origin_warehouse}
            onChange={set('origin_warehouse')}
            placeholder="optional"
            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: '#e5e5e5' }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>
            Number of Bags <span style={{ color: '#d60000' }}>*</span>
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={form.bag_count}
            onChange={set('bag_count')}
            placeholder="10"
            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: '#e5e5e5' }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>
            Weight per Bag (lbs) <span style={{ color: '#d60000' }}>*</span>
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.bag_weight_lbs}
            onChange={set('bag_weight_lbs')}
            placeholder="132.28"
            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: '#e5e5e5' }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Price per lb ($)</label>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={form.price_per_lb}
            onChange={set('price_per_lb')}
            placeholder="optional"
            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: '#e5e5e5' }}
          />
        </div>

        {/* Total weight calculated */}
        {totalWt > 0 && (
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-sm" style={{ color: '#466c7e' }}>
              Total weight: <strong>{totalWt.toFixed(2)} lbs</strong>
              {' '}({bags} bag{bags !== 1 ? 's' : ''} × {bagWt.toFixed(2)} lbs)
            </p>
          </div>
        )}

        <div className="sm:col-span-2 lg:col-span-3">
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Notes</label>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            rows={2}
            className="w-full border rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-1"
            style={{ borderColor: '#e5e5e5' }}
          />
        </div>

        {error && (
          <p className="text-sm sm:col-span-2 lg:col-span-3" style={{ color: '#d60000' }}>{error}</p>
        )}

        <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="text-white text-sm font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#466c7e' }}
          >
            {saving ? 'Saving…' : 'Save Lot'}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setForm(EMPTY_LOT_FORM); setError(null) }}
            className="text-sm px-3 py-2 hover:opacity-70 transition-opacity"
            style={{ color: '#777' }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Transaction Log + Adjustment Form ─────────────────────────────────────────

function LotExpandedDetail({
  lot,
  onUpdated,
  onArchived,
}: {
  lot: GreenLot
  onUpdated: (updated: GreenLot) => void
  onArchived: (id: number) => void
}) {
  const [transactions, setTransactions] = useState<GreenLotTransaction[] | null>(null)
  const [loadingTx, setLoadingTx] = useState(false)
  const [txError, setTxError] = useState<string | null>(null)

  // Which inline form is open: null | 'transfer' | 'adjustment'
  const [openForm, setOpenForm] = useState<'transfer' | 'adjustment' | null>(null)

  // Transfer form state
  const [xferBags, setXferBags] = useState('')
  const [xferDirection, setXferDirection] = useState<'toRoastery' | 'toWarehouse'>('toRoastery')
  const [xferNotes, setXferNotes] = useState('')
  const [xferSaving, setXferSaving] = useState(false)
  const [xferError, setXferError] = useState<string | null>(null)

  // Weight adjustment form state
  const [adjType, setAdjType] = useState<'received' | 'roasted' | 'adjustment'>('adjustment')
  const [adjWeight, setAdjWeight] = useState('')
  const [adjNotes, setAdjNotes] = useState('')
  const [adjSaving, setAdjSaving] = useState(false)
  const [adjError, setAdjError] = useState<string | null>(null)

  const [archiving, setArchiving] = useState(false)

  // Load transactions on mount
  useEffect(() => {
    let cancelled = false
    setLoadingTx(true)
    setTxError(null)
    apiFetch(`/api/green/lots/${lot.id}/transaction`, 'GET')
      .then((data) => { if (!cancelled) setTransactions(data ?? []) })
      .catch((err) => { if (!cancelled) setTxError((err as Error).message) })
      .finally(() => { if (!cancelled) setLoadingTx(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot.id])

  // ── Transfer bags ────────────────────────────────────────────────────────────

  async function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault()
    const bags = parseInt(xferBags, 10)
    if (isNaN(bags) || bags <= 0) { setXferError('Enter a positive number of bags'); return }

    // positive = WH→Roastery, negative = Roastery→WH
    const bagCount = xferDirection === 'toRoastery' ? bags : -bags
    const fromLabel = xferDirection === 'toRoastery' ? (lot.origin_warehouse ?? 'Warehouse') : 'Roastery'
    const toLabel   = xferDirection === 'toRoastery' ? 'Roastery' : (lot.origin_warehouse ?? 'Warehouse')

    setXferSaving(true)
    setXferError(null)
    try {
      const result = await apiFetch(`/api/green/lots/${lot.id}/transaction`, 'POST', {
        type:          'transferred',
        bag_count:     bagCount,
        location_from: fromLabel,
        location_to:   toLabel,
        notes:         xferNotes.trim() || null,
      })
      onUpdated(result.lot)
      setTransactions((prev) => [result.transaction, ...(prev ?? [])])
      setXferBags('')
      setXferNotes('')
      setOpenForm(null)
    } catch (err) {
      setXferError((err as Error).message)
    } finally {
      setXferSaving(false)
    }
  }

  // ── Weight adjustment ────────────────────────────────────────────────────────

  async function handleAdjSubmit(e: React.FormEvent) {
    e.preventDefault()
    const wt = parseFloat(adjWeight)
    if (isNaN(wt) || wt === 0) { setAdjError('Enter a non-zero weight'); return }

    setAdjSaving(true)
    setAdjError(null)
    try {
      const result = await apiFetch(`/api/green/lots/${lot.id}/transaction`, 'POST', {
        type:       adjType,
        weight_lbs: wt,
        notes:      adjNotes.trim() || null,
      })
      onUpdated(result.lot)
      setTransactions((prev) => [result.transaction, ...(prev ?? [])])
      setAdjWeight('')
      setAdjNotes('')
      setOpenForm(null)
    } catch (err) {
      setAdjError((err as Error).message)
    } finally {
      setAdjSaving(false)
    }
  }

  async function handleArchive() {
    if (!confirm(`Archive lot ${lot.lot_number} — ${lot.name}? This cannot be undone easily.`)) return
    setArchiving(true)
    try {
      await apiFetch(`/api/green/lots/${lot.id}/archive`, 'POST')
      onArchived(lot.id)
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setArchiving(false)
    }
  }

  const warehouseLabel = lot.origin_warehouse ?? 'Warehouse'

  return (
    <div className="px-4 pb-4 border-t" style={{ borderColor: '#e5e5e5' }}>
      {/* Detail fields */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
        {lot.producer && (
          <div>
            <span style={{ color: '#777' }}>Producer: </span>
            <span style={{ color: '#3b4858' }}>{lot.producer}</span>
          </div>
        )}
        {lot.harvest_year && (
          <div>
            <span style={{ color: '#777' }}>Harvest: </span>
            <span style={{ color: '#3b4858' }}>{lot.harvest_year}</span>
          </div>
        )}
        {lot.process && (
          <div>
            <span style={{ color: '#777' }}>Process: </span>
            <span style={{ color: '#3b4858' }}>{lot.process}</span>
          </div>
        )}
        {lot.origin_warehouse && (
          <div>
            <span style={{ color: '#777' }}>Origin Warehouse: </span>
            <span style={{ color: '#3b4858' }}>{lot.origin_warehouse}</span>
          </div>
        )}
        <div>
          <span style={{ color: '#777' }}>Bag size: </span>
          <span style={{ color: '#3b4858' }}>{Number(lot.bag_weight_lbs).toFixed(2)} lbs each</span>
        </div>
        <div>
          <span style={{ color: '#777' }}>Added: </span>
          <span style={{ color: '#3b4858' }}>{fmtDate(lot.created_at)}</span>
        </div>
        {lot.notes && (
          <div className="col-span-2 sm:col-span-3">
            <span style={{ color: '#777' }}>Notes: </span>
            <span style={{ color: '#3b4858' }}>{lot.notes}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {openForm === null && (
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setOpenForm('transfer')}
            className="text-xs font-medium px-3 py-1.5 rounded-lg text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#466c7e' }}
          >
            Transfer Bags
          </button>
          <button
            onClick={() => setOpenForm('adjustment')}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-gray-50 transition-colors"
            style={{ borderColor: '#ccc', color: '#3b4858' }}
          >
            Log Weight Change
          </button>
          {lot.status === 'active' && (
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-white hover:opacity-80 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#d60000' }}
            >
              {archiving ? 'Archiving…' : 'Archive'}
            </button>
          )}
        </div>
      )}

      {/* Transfer bags form */}
      {openForm === 'transfer' && (
        <form
          onSubmit={handleTransferSubmit}
          className="mt-3 border rounded-lg p-3 bg-gray-50 space-y-3"
          style={{ borderColor: '#e5e5e5' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#777' }}>
            Transfer Bags
          </p>

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#777' }}>Direction</label>
              <select
                value={xferDirection}
                onChange={(e) => setXferDirection(e.target.value as typeof xferDirection)}
                className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1"
                style={{ borderColor: '#e5e5e5' }}
              >
                <option value="toRoastery">{warehouseLabel} → Roastery</option>
                <option value="toWarehouse">Roastery → {warehouseLabel}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: '#777' }}>
                Number of Bags
                {xferDirection === 'toRoastery'
                  ? ` (${lot.bags_at_warehouse} available at ${warehouseLabel})`
                  : ` (${lot.bags_at_roastery} available at Roastery)`}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={xferBags}
                onChange={(e) => setXferBags(e.target.value)}
                placeholder="10"
                autoFocus
                className="border rounded px-2 py-1.5 text-sm w-24 focus:outline-none focus:ring-1"
                style={{ borderColor: '#e5e5e5' }}
              />
            </div>
          </div>

          {/* Weight preview */}
          {parseInt(xferBags, 10) > 0 && (
            <p className="text-xs" style={{ color: '#466c7e' }}>
              ≈ {(parseInt(xferBags, 10) * Number(lot.bag_weight_lbs)).toFixed(1)} lbs
            </p>
          )}

          <div>
            <label className="block text-xs mb-1" style={{ color: '#777' }}>Notes</label>
            <input
              type="text"
              value={xferNotes}
              onChange={(e) => setXferNotes(e.target.value)}
              placeholder="optional"
              className="border rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1"
              style={{ borderColor: '#e5e5e5' }}
            />
          </div>

          {xferError && <p className="text-xs" style={{ color: '#d60000' }}>{xferError}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={xferSaving}
              className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#466c7e' }}
            >
              {xferSaving ? 'Saving…' : 'Transfer'}
            </button>
            <button
              type="button"
              onClick={() => { setOpenForm(null); setXferError(null) }}
              className="text-xs px-3 py-1.5 hover:opacity-70"
              style={{ color: '#777' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Weight adjustment form */}
      {openForm === 'adjustment' && (
        <form
          onSubmit={handleAdjSubmit}
          className="mt-3 border rounded-lg p-3 bg-gray-50 space-y-3"
          style={{ borderColor: '#e5e5e5' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#777' }}>Log Weight Change</p>

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs mb-1" style={{ color: '#777' }}>Type</label>
              <select
                value={adjType}
                onChange={(e) => setAdjType(e.target.value as typeof adjType)}
                className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1"
                style={{ borderColor: '#e5e5e5' }}
              >
                <option value="roasted">Roasted (use negative lbs)</option>
                <option value="received">Received (additional weight)</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: '#777' }}>
                Weight (lbs) — negative removes weight
              </label>
              <input
                type="number"
                step="0.01"
                value={adjWeight}
                onChange={(e) => setAdjWeight(e.target.value)}
                placeholder="-132.28"
                autoFocus
                className="border rounded px-2 py-1.5 text-sm w-32 focus:outline-none focus:ring-1"
                style={{ borderColor: '#e5e5e5' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: '#777' }}>Notes</label>
            <input
              type="text"
              value={adjNotes}
              onChange={(e) => setAdjNotes(e.target.value)}
              placeholder="optional"
              className="border rounded px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-1"
              style={{ borderColor: '#e5e5e5' }}
            />
          </div>

          {adjError && <p className="text-xs" style={{ color: '#d60000' }}>{adjError}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={adjSaving}
              className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#466c7e' }}
            >
              {adjSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setOpenForm(null); setAdjError(null) }}
              className="text-xs px-3 py-1.5 hover:opacity-70"
              style={{ color: '#777' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Transaction history */}
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#777' }}>
          Transaction History
        </p>
        {loadingTx && <p className="text-xs" style={{ color: '#777' }}>Loading…</p>}
        {txError && <p className="text-xs" style={{ color: '#d60000' }}>{txError}</p>}
        {transactions !== null && transactions.length === 0 && (
          <p className="text-xs italic" style={{ color: '#999' }}>No transactions yet.</p>
        )}
        {transactions && transactions.length > 0 && (
          <div className="divide-y text-xs" style={{ borderColor: '#e5e5e5' }}>
            {transactions.map((tx) => (
              <div key={tx.id} className="py-1.5 flex items-start gap-3 flex-wrap">
                <span
                  className="flex-shrink-0 rounded px-1.5 py-0.5 font-medium capitalize"
                  style={{
                    backgroundColor:
                      tx.type === 'received'    ? '#dcfce7' :
                      tx.type === 'roasted'     ? '#fef3c7' :
                      tx.type === 'transferred' ? '#e0f2fe' : '#f3f4f6',
                    color:
                      tx.type === 'received'    ? '#15803d' :
                      tx.type === 'roasted'     ? '#92400e' :
                      tx.type === 'transferred' ? '#0369a1' : '#374151',
                  }}
                >
                  {tx.type}
                </span>

                {tx.type === 'transferred' && tx.bag_count != null ? (
                  <span style={{ color: '#0369a1' }}>
                    {Math.abs(tx.bag_count)} bag{Math.abs(tx.bag_count) !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span style={{ color: Number(tx.weight_lbs) >= 0 ? '#16a34a' : '#d60000' }}>
                    {Number(tx.weight_lbs) >= 0 ? '+' : ''}{Number(tx.weight_lbs).toFixed(2)} lbs
                  </span>
                )}

                {tx.location_from && tx.location_to && (
                  <span style={{ color: '#777' }}>
                    {tx.location_from} → {tx.location_to}
                  </span>
                )}
                {tx.notes && <span style={{ color: '#999' }}>{tx.notes}</span>}
                <span className="ml-auto flex-shrink-0" style={{ color: '#bbb' }}>
                  {fmtDate(tx.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Lot Row ───────────────────────────────────────────────────────────────────

function LotRow({
  lot,
  onUpdated,
  onArchived,
}: {
  lot: GreenLot
  onUpdated: (updated: GreenLot) => void
  onArchived: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const pct = pctLeft(lot)
  const color = pctColor(pct)
  const isArchived = lot.status === 'archived'

  return (
    <tr
      className={isArchived ? 'opacity-50' : ''}
      style={{ borderBottom: '1px solid #e5e5e5' }}
    >
      {/* We render as a table row but the expand is done via a sub-row mechanism.
          Actually we'll use a div-based table approach for expandable rows. */}
    </tr>
  )
}

// ── Inventory Section ─────────────────────────────────────────────────────────

function InventorySection({
  lots,
  onLotAdded,
  onLotUpdated,
  onLotArchived,
}: {
  lots: GreenLot[]
  onLotAdded: (lot: GreenLot) => void
  onLotUpdated: (lot: GreenLot) => void
  onLotArchived: (id: number) => void
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const active   = lots.filter((l) => l.status === 'active')
  const archived = lots.filter((l) => l.status === 'archived')
  const visible  = showArchived ? lots : active

  function toggleExpand(id: number) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <section className="mb-10">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#3b4858' }}>Green Inventory</h2>
          <p className="text-sm mt-0.5" style={{ color: '#777' }}>
            {active.length} active lot{active.length !== 1 ? 's' : ''}
            {archived.length > 0 && `, ${archived.length} archived`}
          </p>
        </div>
        <AddLotForm onAdded={onLotAdded} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e5e5e5' }}>
        {/* Table header */}
        <div
          className="grid text-xs font-semibold uppercase tracking-wide px-4 py-2"
          style={{
            color: '#777',
            backgroundColor: '#fafafa',
            borderBottom: '1px solid #e5e5e5',
            gridTemplateColumns: '1.5rem 7rem 1fr 7rem 9rem 6rem 6rem 5rem 5rem',
          }}
        >
          <span />
          <span>Lot #</span>
          <span>Name</span>
          <span>Origin</span>
          <span>Bags</span>
          <span className="text-right">On Hand</span>
          <span className="text-right">Initial</span>
          <span className="text-right">% Left</span>
          <span className="text-right">$/lb</span>
        </div>

        {visible.length === 0 && (
          <div className="px-4 py-10 text-center text-sm" style={{ color: '#999' }}>
            No lots yet. Click &quot;Add Lot&quot; to get started.
          </div>
        )}

        {visible.map((lot) => {
          const pct = pctLeft(lot)
          const color = pctColor(pct)
          const isOpen = expandedId === lot.id

          return (
            <div key={lot.id} style={{ borderBottom: '1px solid #e5e5e5' }}>
              {/* Main row */}
              <div
                className="grid items-center px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
                style={{
                  gridTemplateColumns: '1.5rem 7rem 1fr 7rem 9rem 6rem 6rem 5rem 5rem',
                  opacity: lot.status === 'archived' ? 0.55 : 1,
                }}
                onClick={() => toggleExpand(lot.id)}
              >
                <span className="text-xs" style={{ color: '#777' }}>
                  {isOpen ? '▾' : '▸'}
                </span>
                <span className="text-xs font-mono font-semibold" style={{ color: '#466c7e' }}>
                  {lot.lot_number}
                </span>
                <div className="min-w-0">
                  <span
                    className="text-sm font-medium truncate block"
                    style={{ color: '#3b4858' }}
                  >
                    {lot.name}
                  </span>
                  {lot.status === 'archived' && (
                    <span
                      className="text-xs rounded-full px-1.5 py-0.5 font-medium"
                      style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
                    >
                      Archived
                    </span>
                  )}
                </div>
                <span className="text-sm" style={{ color: '#555' }}>{lot.origin}</span>
                {/* Bags: show warehouse and roastery split */}
                <div className="text-xs leading-snug">
                  {Number(lot.bags_at_warehouse) > 0 && (
                    <div style={{ color: '#555' }}>
                      <span style={{ color: '#777' }}>WH </span>
                      {lot.bags_at_warehouse}
                    </div>
                  )}
                  {Number(lot.bags_at_roastery) > 0 && (
                    <div style={{ color: '#555' }}>
                      <span style={{ color: '#777' }}>R&nbsp;&nbsp; </span>
                      {lot.bags_at_roastery}
                    </div>
                  )}
                  {Number(lot.bags_at_warehouse) === 0 && Number(lot.bags_at_roastery) === 0 && (
                    <span style={{ color: '#bbb' }}>—</span>
                  )}
                </div>
                <span className="text-sm text-right" style={{ color: '#3b4858' }}>
                  {fmtLbs(lot.total_weight_lbs)}
                </span>
                <span className="text-sm text-right" style={{ color: '#777' }}>
                  {fmtLbs(lot.initial_weight_lbs)}
                </span>
                <span
                  className="text-sm font-semibold text-right"
                  style={{ color }}
                >
                  {pct.toFixed(0)}%
                </span>
                <span className="text-sm text-right" style={{ color: '#777' }}>
                  {lot.price_per_lb ? `$${Number(lot.price_per_lb).toFixed(2)}` : '—'}
                </span>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <LotExpandedDetail
                  lot={lot}
                  onUpdated={onLotUpdated}
                  onArchived={onLotArchived}
                />
              )}
            </div>
          )
        })}
      </div>

      {archived.length > 0 && (
        <button
          onClick={() => setShowArchived((s) => !s)}
          className="mt-2 text-sm underline hover:opacity-70 transition-opacity"
          style={{ color: '#777' }}
        >
          {showArchived ? 'Hide archived' : `Show ${archived.length} archived lot${archived.length !== 1 ? 's' : ''}`}
        </button>
      )}
    </section>
  )
}

// ── Blend Recipe Form ─────────────────────────────────────────────────────────

interface BlendRow {
  lotId: string
  percentage: string
}

function BlendRecipeForm({
  lots,
  products,
  editingRecipe,
  onSaved,
  onCancel,
}: {
  lots: GreenLot[]
  products: Pick<Product, 'id' | 'name'>[]
  editingRecipe: BlendRecipe | null   // null = new recipe
  onSaved: (recipe: BlendRecipe) => void
  onCancel: () => void
}) {
  const [productId, setProductId] = useState(
    editingRecipe ? String(editingRecipe.product_id) : ''
  )
  const [notes, setNotes] = useState(editingRecipe?.notes ?? '')
  const [rows, setRows] = useState<BlendRow[]>(() => {
    if (editingRecipe?.blend_recipe_items?.length) {
      return editingRecipe.blend_recipe_items.map((item) => ({
        lotId: String(item.green_lot_id),
        percentage: String(item.percentage),
      }))
    }
    return [{ lotId: '', percentage: '' }]
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeLots = lots.filter((l) => l.status === 'active')

  const total = rows.reduce((sum, r) => sum + (parseFloat(r.percentage) || 0), 0)

  function addRow() {
    setRows((prev) => [...prev, { lotId: '', percentage: '' }])
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateRow(i: number, field: keyof BlendRow, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) { setError('Select a product'); return }
    const items = rows.map((r) => ({
      green_lot_id: parseInt(r.lotId, 10),
      percentage:   parseFloat(r.percentage),
    }))
    if (items.some((item) => isNaN(item.green_lot_id) || !item.green_lot_id)) {
      setError('All rows must have a lot selected')
      return
    }
    if (items.some((item) => isNaN(item.percentage) || item.percentage <= 0)) {
      setError('All percentages must be > 0')
      return
    }
    if (Math.abs(total - 100) > 0.01) {
      setError(`Percentages must sum to 100 (currently ${total.toFixed(2)})`)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const result = await apiFetch('/api/green/blends', 'POST', {
        product_id: parseInt(productId, 10),
        notes:      notes.trim() || null,
        items,
      })
      onSaved(result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border p-5"
      style={{ borderColor: '#466c7e', borderWidth: 2 }}
    >
      <h3 className="font-semibold mb-4" style={{ color: '#3b4858' }}>
        {editingRecipe ? `Edit Recipe (v${editingRecipe.version + 1})` : 'New Blend Recipe'}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>
            Product <span style={{ color: '#d60000' }}>*</span>
          </label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={!!editingRecipe}
            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 disabled:opacity-60"
            style={{ borderColor: '#e5e5e5' }}
          >
            <option value="">— Select product —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Recipe Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Spring 2025 season"
            className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1"
            style={{ borderColor: '#e5e5e5' }}
          />
        </div>
      </div>

      {/* Lot rows */}
      <div className="space-y-2 mb-3">
        <div className="grid gap-2 text-xs font-medium" style={{ color: '#777', gridTemplateColumns: '1fr 8rem 2rem' }}>
          <span>Green Lot</span>
          <span>Percentage</span>
          <span />
        </div>
        {rows.map((row, i) => (
          <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 8rem 2rem' }}>
            <select
              value={row.lotId}
              onChange={(e) => updateRow(i, 'lotId', e.target.value)}
              className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1"
              style={{ borderColor: '#e5e5e5' }}
            >
              <option value="">— Select lot —</option>
              {activeLots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.lot_number} — {l.name}
                </option>
              ))}
            </select>
            <div className="relative">
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={row.percentage}
                onChange={(e) => updateRow(i, 'percentage', e.target.value)}
                placeholder="50.00"
                className="w-full border rounded pl-2 pr-6 py-1.5 text-sm focus:outline-none focus:ring-1"
                style={{ borderColor: '#e5e5e5' }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#777' }}>%</span>
            </div>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="text-xs hover:opacity-70 transition-opacity"
                style={{ color: '#d60000' }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Total indicator */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={addRow}
          className="text-xs underline hover:opacity-70 transition-opacity"
          style={{ color: '#466c7e' }}
        >
          + Add lot
        </button>
        <span
          className="text-sm font-semibold ml-auto"
          style={{ color: Math.abs(total - 100) < 0.01 ? '#16a34a' : '#ca8a04' }}
        >
          Total: {total.toFixed(2)}%{Math.abs(total - 100) < 0.01 ? ' ✓' : ' (must equal 100)'}
        </span>
      </div>

      {error && <p className="text-sm mb-3" style={{ color: '#d60000' }}>{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="text-white text-sm font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#466c7e' }}
        >
          {saving ? 'Saving…' : editingRecipe ? 'Save New Version' : 'Create Recipe'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm px-3 py-2 hover:opacity-70 transition-opacity"
          style={{ color: '#777' }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Blend Recipe Card ─────────────────────────────────────────────────────────

function BlendRecipeCard({
  recipe,
  lots,
  products,
  onUpdated,
}: {
  recipe: BlendRecipe
  lots: GreenLot[]
  products: Pick<Product, 'id' | 'name'>[]
  onUpdated: (recipe: BlendRecipe) => void
}) {
  const [editing, setEditing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<BlendRecipe[] | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  async function loadHistory() {
    if (history !== null) { setShowHistory((s) => !s); return }
    setLoadingHistory(true)
    try {
      const data = await apiFetch(`/api/green/blends?product_id=${recipe.product_id}`, 'GET')
      setHistory(data ?? [])
      setShowHistory(true)
    } catch {
      // silent
    } finally {
      setLoadingHistory(false)
    }
  }

  const items = recipe.blend_recipe_items ?? []
  const productName = recipe.products?.name ?? `Product #${recipe.product_id}`

  if (editing) {
    return (
      <BlendRecipeForm
        lots={lots}
        products={products}
        editingRecipe={recipe}
        onSaved={(updated) => { onUpdated(updated); setEditing(false) }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#e5e5e5' }}>
      {/* Card header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="font-semibold" style={{ color: '#3b4858' }}>{productName}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-xs rounded-full px-2 py-0.5 font-medium"
              style={{ backgroundColor: '#eaf1f4', color: '#466c7e' }}
            >
              v{recipe.version}
            </span>
            {recipe.notes && (
              <span className="text-xs" style={{ color: '#777' }}>{recipe.notes}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="text-xs underline hover:opacity-70 transition-opacity"
            style={{ color: '#466c7e' }}
          >
            Edit
          </button>
          <button
            onClick={loadHistory}
            disabled={loadingHistory}
            className="text-xs underline hover:opacity-70 transition-opacity disabled:opacity-50"
            style={{ color: '#777' }}
          >
            {loadingHistory ? 'Loading…' : showHistory ? 'Hide history' : 'History'}
          </button>
        </div>
      </div>

      {/* Lot list */}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <span className="font-mono text-xs font-semibold" style={{ color: '#466c7e' }}>
              {item.green_lots?.lot_number ?? `Lot #${item.green_lot_id}`}
            </span>
            <span style={{ color: '#3b4858' }}>
              {item.green_lots?.name ?? ''}
            </span>
            <span className="ml-auto font-semibold" style={{ color: '#466c7e' }}>
              {Number(item.percentage).toFixed(1)}%
            </span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-sm italic" style={{ color: '#999' }}>No lots in this recipe.</li>
        )}
      </ul>

      {/* History */}
      {showHistory && history && history.length > 0 && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: '#e5e5e5' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#777' }}>
            Previous versions
          </p>
          <div className="space-y-2">
            {history
              .filter((h) => h.id !== recipe.id)
              .map((h) => (
                <div key={h.id} className="text-xs" style={{ color: '#777' }}>
                  <span className="font-semibold">v{h.version}</span>
                  {h.notes && ` — ${h.notes}`}
                  <span className="ml-2" style={{ color: '#bbb' }}>{fmtDate(h.created_at)}</span>
                  <ul className="ml-3 mt-0.5 space-y-0.5">
                    {(h.blend_recipe_items ?? []).map((item) => (
                      <li key={item.id}>
                        {item.green_lots?.lot_number} {item.green_lots?.name} — {Number(item.percentage).toFixed(1)}%
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            {history.filter((h) => h.id !== recipe.id).length === 0 && (
              <p className="text-xs italic" style={{ color: '#bbb' }}>No previous versions.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Blend Recipes Section ─────────────────────────────────────────────────────

function BlendRecipesSection({
  lots,
  products,
  blendRecipes,
  onRecipeSaved,
}: {
  lots: GreenLot[]
  products: Pick<Product, 'id' | 'name'>[]
  blendRecipes: BlendRecipe[]
  onRecipeSaved: (recipe: BlendRecipe) => void
}) {
  const [showNewForm, setShowNewForm] = useState(false)

  // Products that already have a current recipe
  const coveredProductIds = new Set(blendRecipes.map((r) => r.product_id))

  function handleRecipeSaved(recipe: BlendRecipe) {
    onRecipeSaved(recipe)
    setShowNewForm(false)
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#3b4858' }}>Blend Recipes</h2>
          <p className="text-sm mt-0.5" style={{ color: '#777' }}>
            {blendRecipes.length} recipe{blendRecipes.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!showNewForm && (
          <button
            onClick={() => setShowNewForm(true)}
            className="text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#466c7e' }}
          >
            + New Recipe
          </button>
        )}
      </div>

      {showNewForm && (
        <div className="mb-4">
          <BlendRecipeForm
            lots={lots}
            products={products.filter((p) => !coveredProductIds.has(p.id))}
            editingRecipe={null}
            onSaved={handleRecipeSaved}
            onCancel={() => setShowNewForm(false)}
          />
        </div>
      )}

      {blendRecipes.length === 0 && !showNewForm && (
        <div
          className="bg-white rounded-xl border px-4 py-10 text-center text-sm"
          style={{ borderColor: '#e5e5e5', color: '#999' }}
        >
          No blend recipes yet. Click &quot;New Recipe&quot; to create one.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {blendRecipes.map((recipe) => (
          <BlendRecipeCard
            key={recipe.id}
            recipe={recipe}
            lots={lots}
            products={products}
            onUpdated={onRecipeSaved}
          />
        ))}
      </div>
    </section>
  )
}

// ── GreenClient (main export) ─────────────────────────────────────────────────

interface GreenClientProps {
  initialLots: GreenLot[]
  initialProducts: Pick<Product, 'id' | 'name'>[]
  initialBlendRecipes: BlendRecipe[]
}

export default function GreenClient({
  initialLots,
  initialProducts,
  initialBlendRecipes,
}: GreenClientProps) {
  const [lots, setLots] = useState<GreenLot[]>(initialLots)
  const [blendRecipes, setBlendRecipes] = useState<BlendRecipe[]>(initialBlendRecipes)

  function handleLotAdded(lot: GreenLot) {
    setLots((prev) => [lot, ...prev])
  }

  function handleLotUpdated(updated: GreenLot) {
    setLots((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
  }

  function handleLotArchived(id: number) {
    setLots((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: 'archived' as const } : l))
    )
  }

  function handleRecipeSaved(recipe: BlendRecipe) {
    setBlendRecipes((prev) => {
      // Replace existing recipe for same product if it exists, otherwise prepend
      const filtered = prev.filter((r) => r.product_id !== recipe.product_id)
      return [recipe, ...filtered]
    })
  }

  return (
    <div>
      <InventorySection
        lots={lots}
        onLotAdded={handleLotAdded}
        onLotUpdated={handleLotUpdated}
        onLotArchived={handleLotArchived}
      />

      <BlendRecipesSection
        lots={lots}
        products={initialProducts}
        blendRecipes={blendRecipes}
        onRecipeSaved={handleRecipeSaved}
      />
    </div>
  )
}
