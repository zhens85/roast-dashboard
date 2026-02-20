'use client'

// /portal/update-password — partner lands here after clicking the reset link in their email.
// Supabase appends the session token in the URL hash (#access_token=…&type=recovery).
// The @supabase/ssr browser client picks it up automatically via onAuthStateChange,
// then we call updateUser({ password }) to set the new password.

import { useState, useEffect } from 'react'
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

  if (status === 'idle') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
        <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm text-center text-stone-500">
          Verifying reset link…
        </div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
        <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-stone-800">Link expired</h1>
          <p className="text-stone-500 text-sm">
            This password-reset link is invalid or has expired. Please request a new one.
          </p>
          <a
            href="/portal/reset-password"
            className="block text-center text-sm text-amber-700 hover:text-amber-900 underline"
          >
            Request a new reset link
          </a>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
        <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm space-y-4">
          <div className="text-green-600 text-3xl text-center">✓</div>
          <h1 className="text-xl font-bold text-stone-800 text-center">Password updated!</h1>
          <p className="text-stone-500 text-sm text-center">
            Your password has been changed. You can now sign in with your new password.
          </p>
          <a
            href="/portal/login"
            className="block text-center bg-amber-600 hover:bg-amber-700 text-white
                       font-semibold py-2 rounded-lg transition-colors"
          >
            Sign in
          </a>
        </div>
      </div>
    )
  }

  /* ── ready / saving ── */
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
      <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">☕</span>
            <h1 className="text-2xl font-bold text-stone-800">New Password</h1>
          </div>
          <p className="text-stone-500 text-sm">Choose a new password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1">
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
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800
                         focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-stone-700 mb-1">
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
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800
                         focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {errMsg && (
            <p className="text-red-600 text-sm">{errMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === 'saving'}
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50
                       text-white font-semibold py-2 rounded-lg transition-colors"
          >
            {status === 'saving' ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
