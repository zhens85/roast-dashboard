import { NextRequest, NextResponse } from 'next/server'
import { createPortalSupabaseClient } from '@/lib/supabase-portal'

// POST /api/portal/auth/reset-password
// Sends a password-reset email via Supabase Auth.
// The email contains a link back to /update-password where the partner
// sets their new password (Supabase handles the token in the URL hash).
export async function POST(request: NextRequest) {
  let email: string
  try {
    const body = await request.json()
    if (!body.email || typeof body.email !== 'string') throw new Error('email is required')
    email = body.email.trim().toLowerCase()
  } catch {
    return NextResponse.redirect(new URL('/reset-password?error=invalid', request.url))
  }

  try {
    const supabase = await createPortalSupabaseClient()
    // redirectTo is the page the partner lands on after clicking the link in their email.
    // Supabase appends the token in the URL hash so the browser client can exchange it.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.goodfolks.coffee'}/update-password`,
    })
  } catch {
    // Intentionally swallow errors — we never confirm whether an email exists.
  }

  // Always redirect to the "check your email" confirmation page regardless of whether
  // the email was found. This prevents user enumeration.
  return NextResponse.redirect(new URL('/reset-password?sent=1', request.url))
}
