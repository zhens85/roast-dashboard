'use client'

import { useState } from 'react'
import type { Partner, PartnerTier } from '@/types'

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
  return res.json()
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PartnerForm {
  company_name:   string
  contact_person: string
  email:          string
  temp_password:  string
  phone:          string
  address:        string
  city:           string
  state:          string
  zip_code:       string
  tier_id:        string   // select value is always string; convert to number|null on submit
}

const EMPTY_FORM: PartnerForm = {
  company_name:   '',
  contact_person: '',
  email:          '',
  temp_password:  '',
  phone:          '',
  address:        '',
  city:           '',
  state:          '',
  zip_code:       '',
  tier_id:        '',
}

// ── Partner Row ───────────────────────────────────────────────────────────────

function PartnerRow({
  partner,
  tiers,
  onUpdate,
}: {
  partner: Partner
  tiers: PartnerTier[]
  onUpdate: (p: Partner) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing,  setEditing]  = useState(false)
  const [form, setForm] = useState({
    company_name:   partner.company_name,
    contact_person: partner.contact_person,
    phone:          partner.phone    ?? '',
    address:        partner.address  ?? '',
    city:           partner.city     ?? '',
    state:          partner.state    ?? '',
    zip_code:       partner.zip_code ?? '',
    tier_id:        partner.tier_id ? String(partner.tier_id) : '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const updated = await apiFetch(`/api/partners/${partner.id}`, 'PATCH', {
        company_name:   form.company_name.trim(),
        contact_person: form.contact_person.trim(),
        phone:          form.phone    || null,
        address:        form.address  || null,
        city:           form.city     || null,
        state:          form.state    || null,
        zip_code:       form.zip_code || null,
        tier_id:        form.tier_id  ? Number(form.tier_id) : null,
      })
      onUpdate(updated)
      setEditing(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const tierName = partner.partner_tiers?.name ?? null

  return (
    <div className="bg-white rounded-lg border border-stone-200">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-stone-400 hover:text-stone-700 flex-shrink-0 w-5 text-center"
        >
          {expanded ? '▾' : '▸'}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-stone-900">{partner.company_name}</span>
            {tierName && (
              <span className="text-xs bg-amber-50 text-amber-700 rounded-full px-2 py-0.5">
                {tierName}
              </span>
            )}
          </div>
          <div className="flex gap-3 text-xs text-stone-400 mt-0.5 flex-wrap">
            <span>{partner.contact_person}</span>
            <span>{partner.email}</span>
            {partner.phone && <span>{partner.phone}</span>}
          </div>
        </div>

        <button
          onClick={() => { setEditing((e) => !e); setExpanded(true) }}
          className="text-xs text-stone-400 hover:text-stone-700 underline flex-shrink-0"
        >
          Edit
        </button>
      </div>

      {/* Expanded detail + edit form */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-stone-100">
          {editing ? (
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                             focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Contact Name *</label>
                <input
                  type="text"
                  value={form.contact_person}
                  onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                             focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                             focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Partner Tier</label>
                <select
                  value={form.tier_id}
                  onChange={(e) => setForm((f) => ({ ...f, tier_id: e.target.value }))}
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                             focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  <option value="">No tier</option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-500 mb-1">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Street address"
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                             focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">City</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                             focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">State</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    maxLength={2}
                    placeholder="KY"
                    className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm uppercase
                               focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">ZIP</label>
                  <input
                    type="text"
                    value={form.zip_code}
                    onChange={(e) => setForm((f) => ({ ...f, zip_code: e.target.value }))}
                    className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                               focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>

              {error && <p className="text-red-600 text-xs sm:col-span-2">{error}</p>}

              <div className="sm:col-span-2 flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
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
          ) : (
            // Read-only detail view
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <Detail label="Email"   value={partner.email} />
              <Detail label="Phone"   value={partner.phone} />
              <Detail label="Address" value={[partner.address, partner.city, partner.state, partner.zip_code].filter(Boolean).join(', ')} />
              <Detail label="Tier"    value={tierName ?? 'No tier'} />
              <Detail label="Member since" value={new Date(partner.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-2">
      <span className="text-stone-400 w-28 flex-shrink-0">{label}</span>
      <span className="text-stone-700">{value}</span>
    </div>
  )
}

// ── Create Partner Form ───────────────────────────────────────────────────────

function CreatePartnerForm({
  tiers,
  onCreated,
}: {
  tiers: PartnerTier[]
  onCreated: (p: Partner) => void
}) {
  const [open,   setOpen]   = useState(false)
  const [form,   setForm]   = useState<PartnerForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_name.trim() || !form.contact_person.trim() || !form.email.trim() || !form.temp_password) {
      setError('Company name, contact name, email, and temporary password are required.')
      return
    }
    setSaving(true); setError(null)
    try {
      const created = await apiFetch('/api/partners', 'POST', {
        company_name:   form.company_name.trim(),
        contact_person: form.contact_person.trim(),
        email:          form.email.trim().toLowerCase(),
        temp_password:  form.temp_password,
        phone:          form.phone    || null,
        address:        form.address  || null,
        city:           form.city     || null,
        state:          form.state    || null,
        zip_code:       form.zip_code || null,
        tier_id:        form.tier_id  ? Number(form.tier_id) : null,
      })
      onCreated(created)
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
        + Create New Partner Account
      </button>
    )
  }

  return (
    <div className="bg-white rounded-lg border-2 border-amber-400 p-5">
      <h3 className="font-semibold text-stone-800 mb-1">New Partner Account</h3>
      <p className="text-xs text-stone-400 mb-4">
        The partner will use this email and temporary password to log into the ordering portal.
      </p>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Required fields */}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Company Name *</label>
          <input
            type="text"
            value={form.company_name}
            onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
            autoFocus
            required
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Contact Name *</label>
          <input
            type="text"
            value={form.contact_person}
            onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
            required
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Email Address *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
            autoComplete="off"
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">
            Temporary Password *
            <span className="text-stone-400 font-normal ml-1">(min. 8 chars)</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.temp_password}
              onChange={(e) => setForm((f) => ({ ...f, temp_password: e.target.value }))}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full border border-stone-300 rounded px-2 py-1.5 pr-16 text-sm
                         focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-400
                         hover:text-stone-600"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* Optional fields */}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Partner Tier</label>
          <select
            value={form.tier_id}
            onChange={(e) => setForm((f) => ({ ...f, tier_id: e.target.value }))}
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="">No tier</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{Number(t.discount_pct) > 0 ? ` (${Number(t.discount_pct)}% off)` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-stone-500 mb-1">Street Address</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">City</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                       focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">State</label>
            <input
              type="text"
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
              maxLength={2}
              placeholder="KY"
              className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm uppercase
                         focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">ZIP Code</label>
            <input
              type="text"
              value={form.zip_code}
              onChange={(e) => setForm((f) => ({ ...f, zip_code: e.target.value }))}
              className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm
                         focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-600 text-xs sm:col-span-2">{error}</p>
        )}

        {/* Note about temp password */}
        <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-800">
            <strong>Note:</strong> Share the email and temporary password with the partner so they can log in at{' '}
            <span className="font-mono">goodfolks.coffee</span>.
            They can change their password after logging in via their account settings.
          </p>
        </div>

        <div className="sm:col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white
                       text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Creating Account…' : 'Create Partner Account'}
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

// ── PartnersClient (main export) ──────────────────────────────────────────────

export default function PartnersClient({
  initialPartners,
  tiers,
}: {
  initialPartners: Partner[]
  tiers: PartnerTier[]
}) {
  const [partners, setPartners] = useState<Partner[]>(initialPartners)

  function handleUpdate(updated: Partner) {
    setPartners((prev) => prev.map((p) => p.id === updated.id ? updated : p))
  }

  function handleCreated(partner: Partner) {
    setPartners((prev) =>
      [...prev, partner].sort((a, b) => a.company_name.localeCompare(b.company_name))
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500">
        {partners.length} partner{partners.length !== 1 ? 's' : ''}
      </p>

      {partners.map((partner) => (
        <PartnerRow
          key={partner.id}
          partner={partner}
          tiers={tiers}
          onUpdate={handleUpdate}
        />
      ))}

      {partners.length === 0 && (
        <div className="bg-white rounded-lg border border-stone-200 p-10 text-center text-stone-400 text-sm">
          No partners yet. Create the first one below.
        </div>
      )}

      <CreatePartnerForm tiers={tiers} onCreated={handleCreated} />
    </div>
  )
}
