import { NextRequest, NextResponse } from 'next/server'
import { createPortalSupabaseClient } from '@/lib/supabase-portal'
import { sendApprovalRequestEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  const formData      = await request.formData()
  const email         = (formData.get('email') as string)?.trim()
  const password      = formData.get('password') as string
  const companyName   = (formData.get('company_name') as string)?.trim()
  const contactPerson = (formData.get('contact_person') as string)?.trim()

  if (!email || !password || !companyName || !contactPerson) {
    const url = new URL('/signup', request.url)
    url.searchParams.set('error', 'missing')
    return NextResponse.redirect(url, { status: 303 })
  }

  if (password.length < 8) {
    const url = new URL('/signup', request.url)
    url.searchParams.set('error', 'password_short')
    return NextResponse.redirect(url, { status: 303 })
  }

  const supabase = await createPortalSupabaseClient()

  // Step 1: Create the Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError || !authData.user) {
    const url = new URL('/signup', request.url)
    url.searchParams.set('error', authError?.message?.includes('already') ? 'email_taken' : 'auth_error')
    return NextResponse.redirect(url, { status: 303 })
  }

  // Step 2: Insert the partner profile row — is_approved defaults to false
  const { error: partnerError } = await supabase
    .from('partners')
    .insert({
      id:             authData.user.id,
      email,
      company_name:   companyName,
      contact_person: contactPerson,
      is_approved:    false,
    })

  if (partnerError) {
    console.error('Error inserting partner profile:', partnerError)
    const url = new URL('/signup', request.url)
    url.searchParams.set('error', 'profile_error')
    return NextResponse.redirect(url, { status: 303 })
  }

  // Step 3: Sign them out — they must wait for approval before accessing the portal
  await supabase.auth.signOut()

  // Step 4: Notify staff so they can review and approve the account
  try {
    await sendApprovalRequestEmail({
      companyName,
      contactPerson,
      email,
      partnerId: authData.user.id,
    })
  } catch (err) {
    console.error('Approval request email failed:', err)
  }

  // Redirect to login page with a pending_approval notice
  const url = new URL('/', request.url)
  url.searchParams.set('notice', 'pending_approval')
  return NextResponse.redirect(url, { status: 303 })
}
