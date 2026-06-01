'use client'

import { useState } from 'react'
import type { Partner } from '@/types'

interface Props {
  initialPartner: Partner
}

const inputCls = `w-full border rounded-lg px-3 py-2.5 text-sm
  focus:outline-none focus:ring-2 transition-colors`
const inputStyle = { borderColor: '#d0d0d0', color: '#3b4858' }

const labelCls = 'block text-sm font-medium mb-1'
const labelStyle = { color: '#3b4858' }

export default function AccountClient({ initialPartner }: Props) {
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
