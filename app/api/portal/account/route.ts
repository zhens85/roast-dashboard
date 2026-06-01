import { NextRequest, NextResponse } from 'next/server'
import { createPortalSupabaseClient } from '@/lib/supabase-portal'

// Fields a partner is allowed to update on their own profile.
// Excludes email (tied to Supabase auth), tier_id and is_approved (admin-only).
const ALLOWED_FIELDS = [
  'company_name',
  'contact_person',
  'phone',
  'address',
  'city',
  'state',
  'zip_code',
] as const

// GET /api/portal/account — return the current partner's profile
export async function GET() {
  const supabase = await createPortalSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/portal/account — update the current partner's own profile
export async function PATCH(request: NextRequest) {
  const supabase = await createPortalSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let updates: Record<string, unknown>
  try {
    const body = await request.json()
    updates = {}
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        // Coerce empty strings to null for optional fields
        const val = body[field]
        updates[field] = typeof val === 'string' && val.trim() === '' ? null : val
      }
    }
    if (Object.keys(updates).length === 0) {
      throw new Error('No updatable fields provided')
    }
    if (updates.company_name !== undefined && !updates.company_name) {
      throw new Error('Company name is required')
    }
    if (updates.contact_person !== undefined && !updates.contact_person) {
      throw new Error('Contact person is required')
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('partners')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
