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
  tier_id:        string
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

// ── Shared input className ────────────────────────────────────────────────────

const inputCls = `w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2`
const inputStyle = { borderColor: '#d0d0d0', color: '#3b4858' }

// ── Partner Row ───────────────────────────────────────────────────────────────

function PartnerRow({
  partner,
  tiers,
  onUpdate,
  onDelete,
}: {
  partner:  Partner
  tiers:    PartnerTier[]
  onUpdate: (p: Partner) => void
  onDelete: (id: string) => void
}) {
  const [expanded,     setExpanded]     = useState(!partner.is_approved) // auto-expand pending
  const [editing,      setEditing]      = useState(false)
  const [changingPw,   setChangingPw]   = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [approving,    setApproving]    = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)

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

  const [newPassword,     setNewPassword]     = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [pwSaving,        setPwSaving]        = useState(false)
  const [pwSuccess,       setPwSuccess]       = useState(false)
  const [pwError,         setPwError]         = useState<string | null>(null)

  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true); setSaveError(null)
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
      setSaveError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters.')
      return
    }
    setPwSaving(true); setPwError(null); setPwSuccess(false)
    try {
      await apiFetch(`/api/partners/${partner.id}/password`, 'PATCH', { password: newPassword })
      setPwSuccess(true)
      setNewPassword('')
      setTimeout(() => {
        setPwSuccess(false)
        setChangingPw(false)
      }, 2500)
    } catch (err) {
      setPwError((err as Error).message)
    } finally {
      setPwSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(
      `Permanently delete ${partner.company_name}?\n\nThis will remove their account and they will no longer be able to log in. This cannot be undone.`
    )) return

    setDeleting(true); setDeleteError(null)
    try {
      await apiFetch(`/api/partners/${partner.id}`, 'DELETE')
      onDelete(partner.id)
    } catch (err) {
      setDeleteError((err as Error).message)
      setDeleting(false)
    }
  }

  async function handleApprove(approved: boolean) {
    setApproving(true); setApproveError(null)
    try {
      const updated = await apiFetch(`/api/partners/${partner.id}/approve`, 'POST', { approved })
      onUpdate(updated)
    } catch (err) {
      setApproveError((err as Error).message)
    } finally {
      setApproving(false)
    }
  }

  const tierName = partner.partner_tiers?.name ?? null

  return (
    <div className="bg-white rounded-lg border" style={{ borderColor: '#e5e5e5' }}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex-shrink-0 w-5 text-center hover:opacity-70 transition-opacity"
          style={{ color: '#999' }}
        >
          {expanded ? '▾' : '▸'}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold" style={{ color: '#3b4858' }}>
              {partner.company_name}
            </span>
            {!partner.is_approved && (
              <span
                className="text-xs rounded-full px-2 py-0.5 font-medium"
                style={{ backgroundColor: '#fff3cd', color: '#856404' }}
              >
                Pending Approval
              </span>
            )}
            {tierName && (
              <span
                className="text-xs rounded-full px-2 py-0.5"
                style={{ backgroundColor: '#f0f4f5', color: '#466c7e' }}
              >
                {tierName}
              </span>
            )}
          </div>
          <div className="flex gap-3 text-xs mt-0.5 flex-wrap" style={{ color: '#999' }}>
            <span>{partner.contact_person}</span>
            <span>{partner.email}</span>
            {partner.phone && <span>{partner.phone}</span>}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {!partner.is_approved ? (
            <button
              onClick={() => handleApprove(true)}
              disabled={approving}
              className="text-xs font-semibold px-3 py-1 rounded-lg text-white
                         hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: '#2d7a4f' }}
            >
              {approving ? 'Approving…' : 'Approve'}
            </button>
          ) : (
            <button
              onClick={() => handleApprove(false)}
              disabled={approving}
              className="text-xs underline hover:opacity-70 transition-opacity disabled:opacity-50"
              style={{ color: '#999' }}
            >
              {approving ? '…' : 'Revoke'}
            </button>
          )}
          <button
            onClick={() => { setEditing((e) => !e); setExpanded(true) }}
            className="text-xs underline hover:opacity-70 transition-opacity"
            style={{ color: '#466c7e' }}
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs underline hover:opacity-70 transition-opacity disabled:opacity-50"
            style={{ color: '#d60000' }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {deleteError && (
        <p className="px-4 pb-2 text-xs" style={{ color: '#d60000' }}>{deleteError}</p>
      )}
      {approveError && (
        <p className="px-4 pb-2 text-xs" style={{ color: '#d60000' }}>{approveError}</p>
      )}

      {/* Expanded section */}
      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: '#f0f0f0' }}>

          {/* ── Profile edit / read-only ── */}
          {editing ? (
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>
                  Company Name *
                </label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>
                  Contact Name *
                </label>
                <input
                  type="text"
                  value={form.contact_person}
                  onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Partner Tier</label>
                <select
                  value={form.tier_id}
                  onChange={(e) => setForm((f) => ({ ...f, tier_id: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="">No tier</option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Street address"
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>City</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>State</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    maxLength={2}
                    placeholder="KY"
                    className={`${inputCls} uppercase`}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>ZIP</label>
                  <input
                    type="text"
                    value={form.zip_code}
                    onChange={(e) => setForm((f) => ({ ...f, zip_code: e.target.value }))}
                    className={inputCls}
                    style={inputStyle}
                  />
                </div>
              </div>

              {saveError && (
                <p className="text-xs sm:col-span-2" style={{ color: '#d60000' }}>{saveError}</p>
              )}

              <div className="sm:col-span-2 flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-white text-sm font-semibold px-4 py-1.5 rounded-lg
                             hover:opacity-90 disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: '#466c7e' }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-sm px-3 py-1.5 hover:opacity-70 transition-opacity"
                  style={{ color: '#777' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <Detail label="Email"        value={partner.email} />
              <Detail label="Phone"        value={partner.phone} />
              <Detail label="Address"      value={[partner.address, partner.city, partner.state, partner.zip_code].filter(Boolean).join(', ')} />
              <Detail label="Tier"         value={tierName ?? 'No tier'} />
              <Detail label="Member since" value={new Date(partner.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
            </div>
          )}

          {/* ── Change Password ── */}
          <div className="mt-4 pt-4 border-t" style={{ borderColor: '#f0f0f0' }}>
            {!changingPw ? (
              <button
                onClick={() => { setChangingPw(true); setPwSuccess(false); setPwError(null) }}
                className="text-xs underline hover:opacity-70 transition-opacity"
                style={{ color: '#466c7e' }}
              >
                Change password
              </button>
            ) : (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: '#777' }}>
                  Set a new password for {partner.company_name}
                </p>
                <div className="flex items-center gap-2 max-w-sm">
                  <div className="relative flex-1">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min. 8 chars)"
                      autoComplete="new-password"
                      className={`${inputCls} pr-14`}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs hover:opacity-70"
                      style={{ color: '#999' }}
                    >
                      {showNewPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <button
                    onClick={handleChangePassword}
                    disabled={pwSaving || pwSuccess}
                    className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg
                               hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
                    style={{ backgroundColor: '#466c7e' }}
                  >
                    {pwSaving ? 'Saving…' : pwSuccess ? '✓ Saved!' : 'Set Password'}
                  </button>
                  <button
                    onClick={() => { setChangingPw(false); setNewPassword(''); setPwError(null) }}
                    className="text-xs hover:opacity-70 transition-opacity"
                    style={{ color: '#777' }}
                  >
                    Cancel
                  </button>
                </div>
                {pwError && (
                  <p className="mt-1 text-xs" style={{ color: '#d60000' }}>{pwError}</p>
                )}
                {pwSuccess && (
                  <p className="mt-1 text-xs" style={{ color: '#2d7a4f' }}>
                    Password updated successfully.
                  </p>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex gap-2">
      <span className="w-28 flex-shrink-0" style={{ color: '#999' }}>{label}</span>
      <span style={{ color: '#3b4858' }}>{value}</span>
    </div>
  )
}

// ── Create Partner Form ───────────────────────────────────────────────────────

function CreatePartnerForm({
  tiers,
  onCreated,
}: {
  tiers:     PartnerTier[]
  onCreated: (p: Partner) => void
}) {
  const [open,         setOpen]         = useState(false)
  const [form,         setForm]         = useState<PartnerForm>(EMPTY_FORM)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)
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
        className="w-full border-2 border-dashed rounded-lg py-3 text-sm font-medium
                   hover:opacity-80 transition-opacity"
        style={{ borderColor: '#d0d0d0', color: '#777' }}
      >
        + Create New Partner Account
      </button>
    )
  }

  return (
    <div className="bg-white rounded-lg border-2 p-5" style={{ borderColor: '#466c7e' }}>
      <h3 className="font-semibold mb-1" style={{ color: '#3b4858' }}>New Partner Account</h3>
      <p className="text-xs mb-4" style={{ color: '#999' }}>
        The partner will use this email and temporary password to log into the ordering portal.
      </p>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>
            Company Name *
          </label>
          <input
            type="text"
            value={form.company_name}
            onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
            autoFocus
            required
            className={inputCls}
            style={inputStyle}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>
            Contact Name *
          </label>
          <input
            type="text"
            value={form.contact_person}
            onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
            required
            className={inputCls}
            style={inputStyle}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>
            Email Address *
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
            autoComplete="off"
            className={inputCls}
            style={inputStyle}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>
            Temporary Password *
            <span className="font-normal ml-1" style={{ color: '#bbb' }}>(min. 8 chars)</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.temp_password}
              onChange={(e) => setForm((f) => ({ ...f, temp_password: e.target.value }))}
              required
              minLength={8}
              autoComplete="new-password"
              className={`${inputCls} pr-16`}
              style={inputStyle}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs hover:opacity-70"
              style={{ color: '#999' }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className={inputCls}
            style={inputStyle}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Partner Tier</label>
          <select
            value={form.tier_id}
            onChange={(e) => setForm((f) => ({ ...f, tier_id: e.target.value }))}
            className={inputCls}
            style={inputStyle}
          >
            <option value="">No tier</option>
            {tiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{(t.tier_discount_rules?.length ?? 0) > 0 ? ' (discounts)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Street Address</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className={inputCls}
            style={inputStyle}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>City</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            className={inputCls}
            style={inputStyle}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>State</label>
            <input
              type="text"
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
              maxLength={2}
              placeholder="KY"
              className={`${inputCls} uppercase`}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>ZIP Code</label>
            <input
              type="text"
              value={form.zip_code}
              onChange={(e) => setForm((f) => ({ ...f, zip_code: e.target.value }))}
              className={inputCls}
              style={inputStyle}
            />
          </div>
        </div>

        {error && (
          <p className="text-xs sm:col-span-2" style={{ color: '#d60000' }}>{error}</p>
        )}

        <div
          className="sm:col-span-2 rounded-lg px-3 py-2"
          style={{ backgroundColor: '#f0f4f5', borderColor: '#c8d8de', border: '1px solid' }}
        >
          <p className="text-xs" style={{ color: '#466c7e' }}>
            <strong>Note:</strong> Share the email and temporary password with the partner so they can log in at{' '}
            <span className="font-mono">goodfolks.coffee</span>.
            They can change their password after logging in via their account settings.
          </p>
        </div>

        <div className="sm:col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="text-white text-sm font-semibold px-5 py-2 rounded-lg
                       hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: '#466c7e' }}
          >
            {saving ? 'Creating Account…' : 'Create Partner Account'}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setForm(EMPTY_FORM); setError(null) }}
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

// ── PartnersClient (main export) ──────────────────────────────────────────────

export default function PartnersClient({
  initialPartners,
  tiers,
}: {
  initialPartners: Partner[]
  tiers:           PartnerTier[]
}) {
  const [partners, setPartners] = useState<Partner[]>(initialPartners)

  function handleUpdate(updated: Partner) {
    setPartners((prev) => prev.map((p) => p.id === updated.id ? updated : p))
  }

  function handleCreated(partner: Partner) {
    setPartners((prev) =>
      [...prev, partner].sort((a, b) => {
        // Pending partners float to the top
        if (!a.is_approved && b.is_approved)  return -1
        if (a.is_approved  && !b.is_approved) return  1
        return a.company_name.localeCompare(b.company_name)
      })
    )
  }

  function handleDelete(id: string) {
    setPartners((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: '#777' }}>
        {partners.length} partner{partners.length !== 1 ? 's' : ''}
      </p>

      {partners.length === 0 && (
        <div
          className="bg-white rounded-lg border p-10 text-center text-sm"
          style={{ borderColor: '#e5e5e5', color: '#999' }}
        >
          No partners yet. Create the first one below.
        </div>
      )}

      {partners.map((partner) => (
        <PartnerRow
          key={partner.id}
          partner={partner}
          tiers={tiers}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      ))}

      <CreatePartnerForm tiers={tiers} onCreated={handleCreated} />
    </div>
  )
}
