'use client'

// /portal/update-password — partner lands here after clicking the reset link in their email.
// Supabase appends the session token in the URL hash (#access_token=…&type=recovery).
// The @supabase/ssr browser client picks it up automatically via onAuthStateChange,
// then we call updateUser({ password }) to set the new password.

import React, { useState, useEffect } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase-browser'

type Status = 'idle' | 'ready' | 'saving' | 'success' | 'error' | 'invalid'

export default function UpdatePasswordPage() {
  const [status,   setStatus]   = useState<Status>('idle')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [errMsg,   setErrMsg]   = useState('')

  // Wait for Supabase to detect the recovery session from the URL hash
  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('ready')
      }
    })
    // If no recovery event fires within 5s, the link is probably invalid/expired
    const timeout = setTimeout(() => {
      setStatus((prev) => prev === 'idle' ? 'invalid' : prev)
    }, 5000)
    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrMsg('')

    if (password.length < 8) {
      setErrMsg('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setErrMsg('Passwords do not match.')
      return
    }

    setStatus('saving')
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setErrMsg(error.message)
      setStatus('ready')
    } else {
      setStatus('success')
    }
  }

  /* ── States ── */

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ backgroundColor: '#f7f5f2' }}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        {children}
      </div>
    </div>
  )

  if (status === 'idle') {
    return shell(
      <p className="text-center text-sm" style={{ color: '#999' }}>Verifying reset link…</p>
    )
  }

  if (status === 'invalid') {
    return shell(
      <div className="space-y-4">
        <img
          src="//goodfolkscoffee.com/cdn/shop/files/goodfolkshorizontal_383x200.png?v=1614392019"
          alt="Good Folks Coffee"
          className="h-10 w-auto object-contain mx-auto mb-2"
        />
        <h1 className="text-lg font-semibold text-center" style={{ color: '#3b4858' }}>
          Link expired
        </h1>
        <p className="text-sm text-center" style={{ color: '#777777' }}>
          This password-reset link is invalid or has expired. Please request a new one.
        </p>
        <a
          href="/portal/reset-password"
          className="block text-center text-sm underline hover:opacity-70 transition-opacity"
          style={{ color: '#466c7e' }}
        >
          Request a new reset link
        </a>
      </div>
    )
  }

  if (status === 'success') {
    return shell(
      <div className="space-y-4">
        <img
          src="//goodfolkscoffee.com/cdn/shop/files/goodfolkshorizontal_383x200.png?v=1614392019"
          alt="Good Folks Coffee"
          className="h-10 w-auto object-contain mx-auto mb-2"
        />
        <div className="text-3xl text-center">✓</div>
        <h1 className="text-lg font-semibold text-center" style={{ color: '#3b4858' }}>
          Password updated!
        </h1>
        <p className="text-sm text-center" style={{ color: '#777777' }}>
          Your password has been changed. You can now sign in.
        </p>
        <a
          href="/portal/login"
          className="block text-center text-white font-semibold py-2.5 rounded-lg
                     transition-opacity hover:opacity-90 text-sm"
          style={{ backgroundColor: '#466c7e' }}
        >
          Sign in
        </a>
      </div>
    )
  }

  /* ── ready / saving ── */
  return shell(
    <>
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <img
          src="//goodfolkscoffee.com/cdn/shop/files/goodfolkshorizontal_383x200.png?v=1614392019"
          alt="Good Folks Coffee"
          className="h-12 w-auto object-contain mb-5"
        />
        <h1 className="text-lg font-semibold" style={{ color: '#3b4858' }}>New Password</h1>
        <p className="text-sm mt-1" style={{ color: '#777777' }}>
          Choose a new password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1"
                 style={{ color: '#3b4858' }}>
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            autoFocus
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: '#d0d0d0', color: '#3b4858' }}
          />
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium mb-1"
                 style={{ color: '#3b4858' }}>
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: '#d0d0d0', color: '#3b4858' }}
          />
        </div>

        {errMsg && (
          <p className="text-sm" style={{ color: '#d60000' }}>{errMsg}</p>
        )}

        <button
          type="submit"
          disabled={status === 'saving'}
          className="w-full text-white font-semibold py-2.5 rounded-lg transition-opacity
                     hover:opacity-90 disabled:opacity-50 text-sm"
          style={{ backgroundColor: '#466c7e' }}
        >
          {status === 'saving' ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </>
  )
}
