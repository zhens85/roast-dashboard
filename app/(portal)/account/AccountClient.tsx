'use client'

import { useState } from 'react'
import type { Partner, PartnerLocation } from '@/types'

interface Props {
  initialPartner:   Partner
  initialLocations: PartnerLocation[]
}

const inputCls = `w-full border rounded-lg px-3 py-2.5 text-sm
  focus:outline-none focus:ring-2 transition-colors`
const inputStyle = { borderColor: '#d0d0d0', color: '#3b4858' }

const labelCls = 'block text-sm font-medium mb-1'
const labelStyle = { color: '#3b4858' }

// ── Location manager ──────────────────────────────────────────────────────────

const BLANK_LOC = { name: '', contact_person: '', phone: '', address: '', city: '', state: '', zip_code: '', is_default: false }

function LocationsSection({ initialLocations }: { initialLocations: PartnerLocation[] }) {
  const [locations, setLocations]   = useState<PartnerLocation[]>(initialLocations)
  const [editing, setEditing]       = useState<PartnerLocation | 'new' | null>(null)
  const [form, setForm]             = useState({ ...BLANK_LOC })
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  function openNew() {
    setForm({ ...BLANK_LOC })
    setEditing('new')
    setError(null)
  }

  function openEdit(loc: PartnerLocation) {
    setForm({
      name:           loc.name,
      contact_person: loc.contact_person ?? '',
      phone:          loc.phone          ?? '',
      address:        loc.address        ?? '',
      city:           loc.city           ?? '',
      state:          loc.state          ?? '',
      zip_code:       loc.zip_code       ?? '',
      is_default:     loc.is_default,
    })
    setEditing(loc)
    setError(null)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Location name is required'); return }
    setSaving(true); setError(null)
    try {
      const isNew  = editing === 'new'
      const url    = isNew ? '/api/portal/locations' : `/api/portal/locations/${(editing as PartnerLocation).id}`
      const method = isNew ? 'POST' : 'PATCH'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const saved: PartnerLocation = await res.json()

      setLocations(prev => {
        const without = prev.filter(l => l.id !== saved.id)
        const updated = form.is_default
          ? [saved, ...without.map(l => ({ ...l, is_default: false }))]
          : [...without, saved]
        return updated.sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name))
      })
      setEditing(null)
    } catch (e) { setError((e as Error).message) }
    finally { setSaving(false) }
  }

  async function handleDelete(loc: PartnerLocation) {
    if (!confirm(`Delete "${loc.name}"?`)) return
    setSaving(true)
    try {
      await fetch(`/api/portal/locations/${loc.id}`, { method: 'DELETE' })
      setLocations(prev => prev.filter(l => l.id !== loc.id))
    } finally { setSaving(false) }
  }

  return (
    <section className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e5e5e5' }}>
      <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#f0f0f0' }}>
        <div>
          <h2 className="font-semibold" style={{ color: '#3b4858' }}>Locations</h2>
          <p className="text-sm mt-0.5" style={{ color: '#999' }}>
            Add named ship-to addresses to use at checkout.
          </p>
        </div>
        {editing === null && (
          <button onClick={openNew}
                  className="text-sm font-medium px-3 py-1.5 rounded-lg border hover:bg-gray-50"
                  style={{ borderColor: '#d0d0d0', color: '#466c7e' }}>
            + Add Location
          </button>
        )}
      </div>

      {locations.length === 0 && editing === null && (
        <div className="px-6 py-8 text-center text-sm" style={{ color: '#aaa' }}>
          No locations yet. Add one to enable per-location ordering.
        </div>
      )}

      {/* Existing locations */}
      {locations.map(loc => (
        <div key={loc.id}>
          {editing !== 'new' && (editing as PartnerLocation)?.id === loc.id ? (
            <LocationForm form={form} setForm={setForm} saving={saving} error={error}
                          onSave={handleSave} onCancel={() => setEditing(null)} />
          ) : (
            <div className="px-6 py-4 border-b flex items-start justify-between gap-4"
                 style={{ borderColor: '#f5f5f5' }}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm" style={{ color: '#3b4858' }}>{loc.name}</p>
                  {loc.is_default && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f0f4f5', color: '#466c7e' }}>
                      Default
                    </span>
                  )}
                </div>
                {(loc.address || loc.city) && (
                  <p className="text-xs mt-0.5" style={{ color: '#999' }}>
                    {[loc.address, loc.city, loc.state].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => openEdit(loc)}
                        className="text-xs underline hover:opacity-70" style={{ color: '#466c7e' }}>
                  Edit
                </button>
                <button onClick={() => handleDelete(loc)} disabled={saving}
                        className="text-xs underline hover:opacity-70 disabled:opacity-40" style={{ color: '#dc2626' }}>
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* New location form */}
      {editing === 'new' && (
        <LocationForm form={form} setForm={setForm} saving={saving} error={error}
                      onSave={handleSave} onCancel={() => setEditing(null)} />
      )}
    </section>
  )
}

type LocForm = typeof BLANK_LOC
function LocationForm({ form, setForm, saving, error, onSave, onCancel }:
  { form: LocForm; setForm: (f: LocForm) => void; saving: boolean; error: string | null; onSave: () => void; onCancel: () => void }) {
  const inp = (field: keyof LocForm, rest?: React.InputHTMLAttributes<HTMLInputElement>) => ({
    value: form[field] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.target.value }),
    className: 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2',
    style: { borderColor: '#d0d0d0', color: '#3b4858' },
    ...rest,
  })
  return (
    <div className="px-6 py-4 space-y-3 bg-stone-50 border-b" style={{ borderColor: '#f0f0f0' }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Location name *</label>
          <input {...inp('name')} placeholder="Downtown, East Side, Main Street…" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Contact person</label>
          <input {...inp('contact_person')} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Phone</label>
          <input {...inp('phone')} type="tel" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>Street address</label>
          <input {...inp('address')} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>City</label>
          <input {...inp('city')} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>State</label>
            <input {...inp('state')} maxLength={2} placeholder="KY" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 uppercase" style={{ borderColor: '#d0d0d0', color: '#3b4858' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#777' }}>ZIP</label>
            <input {...inp('zip_code')} />
          </div>
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_default}
               onChange={e => setForm({ ...form, is_default: e.target.checked })}
               className="accent-[#466c7e]" />
        <span className="text-sm" style={{ color: '#555' }}>Set as default ship-to location</span>
      </label>
      {error && <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>}
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving}
                className="text-sm font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50 hover:opacity-90"
                style={{ backgroundColor: '#466c7e' }}>
          {saving ? 'Saving…' : 'Save Location'}
        </button>
        <button onClick={onCancel}
                className="text-sm px-4 py-2 rounded-lg border hover:bg-gray-50"
                style={{ borderColor: '#d0d0d0', color: '#666' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function AccountClient({ initialPartner, initialLocations }: Props) {
  const [partner, setPartner]       = useState<Partner>(initialPartner)
  const [companyName, setCompany]   = useState(partner.company_name)
  const [contactPerson, setContact] = useState(partner.contact_person)
  const [phone, setPhone]           = useState(partner.phone ?? '')
  const [address, setAddress]       = useState(partner.address ?? '')
  const [city, setCity]             = useState(partner.city ?? '')
  const [state, setState]           = useState(partner.state ?? '')
  const [zipCode, setZip]           = useState(partner.zip_code ?? '')
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setSaved(false); setError(null)
    try {
      const res = await fetch('/api/portal/account', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name:   companyName.trim(),
          contact_person: contactPerson.trim(),
          phone:          phone.trim(),
          address:        address.trim(),
          city:           city.trim(),
          state:          state.trim(),
          zip_code:       zipCode.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error ?? 'Failed to save')
      }
      const updated: Partner = await res.json()
      setPartner(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Profile form */}
      <section className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e5e5e5' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: '#f0f0f0' }}>
          <h2 className="font-semibold" style={{ color: '#3b4858' }}>Account Details</h2>
          <p className="text-sm mt-0.5" style={{ color: '#999' }}>
            Update your company info and shipping address.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Email — read-only */}
          <div>
            <label className={labelCls} style={labelStyle}>Email</label>
            <input
              type="email"
              value={partner.email}
              readOnly
              className={inputCls + ' cursor-not-allowed'}
              style={{ ...inputStyle, backgroundColor: '#f9f9f9', color: '#999' }}
            />
            <p className="text-xs mt-1" style={{ color: '#bbb' }}>
              Email can't be changed here. Contact us if you need to update it.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={labelStyle}>Company Name *</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompany(e.target.value)}
                required
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Contact Person *</label>
              <input
                type="text"
                value={contactPerson}
                onChange={e => setContact(e.target.value)}
                required
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
              className={inputCls}
              style={inputStyle}
            />
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Street Address</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="123 Main St"
              className={inputCls}
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls} style={labelStyle}>City</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>State</label>
              <input
                type="text"
                value={state}
                onChange={e => setState(e.target.value)}
                placeholder="KY"
                maxLength={2}
                className={inputCls + ' uppercase'}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>ZIP Code</label>
              <input
                type="text"
                value={zipCode}
                onChange={e => setZip(e.target.value)}
                placeholder="40202"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="text-white font-semibold px-5 py-2.5 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 text-sm"
              style={{ backgroundColor: '#466c7e' }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {saved && (
              <span className="text-sm font-medium" style={{ color: '#15803d' }}>
                ✓ Saved
              </span>
            )}
          </div>
        </form>
      </section>

      <LocationsSection initialLocations={initialLocations} />

      {/* Password */}
      <section className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e5e5e5' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: '#f0f0f0' }}>
          <h2 className="font-semibold" style={{ color: '#3b4858' }}>Password</h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm mb-3" style={{ color: '#777' }}>
            Use the link below to receive a password reset email.
          </p>
          <a
            href="/reset-password"
            className="inline-block text-sm font-medium underline hover:opacity-70 transition-opacity"
            style={{ color: '#466c7e' }}
          >
            Send password reset email →
          </a>
        </div>
      </section>
    </div>
  )
}
