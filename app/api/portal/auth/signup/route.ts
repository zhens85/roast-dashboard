import { NextRequest, NextResponse } from 'next/server'
import { createPortalSupabaseClient } from '@/lib/supabase-portal'

export async function POST(request: NextRequest) {
  const formData      = await request.formData()
  const email         = (formData.get('email') as string)?.trim()
  const password      = formData.get('password') as string
  const companyName   = (formData.get('company_name') as string)?.trim()
  const contactPerson = (formData.get('contact_person') as string)?.trim()

  if (!email || !password || !companyName || !contactPerson) {
    const url = new URL('/portal/signup', request.url)
    url.searchParams.set('error', 'missing')
    return NextResponse.redirect(url, { status: 303 })
  }

  if (password.length < 8) {
    const url = new URL('/portal/signup', request.url)
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
    const url = new URL('/portal/signup', request.url)
    // Common case: email already registered
    url.searchParams.set('error', authError?.message?.includes('already') ? 'email_taken' : 'auth_error')
    return NextResponse.redirect(url, { status: 303 })
  }

  // Step 2: Insert the partner profile row
  // The user is now auth'd as the new user (session cookie set by signUp),
  // so the partners INSERT RLS policy (id = auth.uid()) will pass.
  const { error: partnerError } = await supabase
    .from('partners')
    .insert({
      id:             authData.user.id,
      email,
      company_name:   companyName,
      contact_person: contactPerson,
    })

  if (partnerError) {
    console.error('Error inserting partner profile:', partnerError)
    // Auth user was created but partner row failed — redirect with error
    // User can try signing in and we can investigate the DB issue
    const url = new URL('/portal/signup', request.url)
    url.searchParams.set('error', 'profile_error')
    return NextResponse.redirect(url, { status: 303 })
  }

  // Session cookie is already set — redirect to products
  return NextResponse.redirect(new URL('/portal/products', request.url), { status: 303 })
}
