import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

// GET /api/partners — list all partners with tier info
export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('partners')
    .select('*, partner_tiers(*)')
    .order('company_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/partners — create a new partner account (staff-initiated)
// Uses the service role's admin auth to create the Supabase Auth user,
// then inserts the partner profile row.
export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
    if (!body.email)          throw new Error('email is required')
    if (!body.company_name)   throw new Error('company_name is required')
    if (!body.contact_person) throw new Error('contact_person is required')
    if (!body.temp_password)  throw new Error('temp_password is required')
    if ((body.temp_password as string).length < 8) {
      throw new Error('temp_password must be at least 8 characters')
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // Step 1: Create the Supabase Auth user via the admin API
  // The service role key has access to supabase.auth.admin.createUser()
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email:           body.email as string,
    password:        body.temp_password as string,
    email_confirm:   true,  // skip email confirmation — staff is creating on their behalf
  })

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message ?? 'Failed to create auth user' },
      { status: 500 }
    )
  }

  // Step 2: Insert the partner profile row
  const { data: partner, error: partnerError } = await supabase
    .from('partners')
    .insert({
      id:             authData.user.id,
      email:          body.email,
      company_name:   body.company_name,
      contact_person: body.contact_person,
      phone:          body.phone          ?? null,
      address:        body.address        ?? null,
      city:           body.city           ?? null,
      state:          body.state          ?? null,
      zip_code:       body.zip_code       ?? null,
      tier_id:        body.tier_id        ?? null,
    })
    .select('*, partner_tiers(*)')
    .single()

  if (partnerError) {
    // Auth user was created but profile insert failed.
    // Clean up the orphaned auth user so staff can retry.
    await supabase.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json(
      { error: `Profile creation failed: ${partnerError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json(partner, { status: 201 })
}
