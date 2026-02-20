import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

// PATCH /api/partners/[id] — update partner profile fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: partnerId } = await params

  let updates: Record<string, unknown>
  try {
    const body = await request.json()
    updates = {}
    const fields = [
      'company_name', 'contact_person', 'phone',
      'address', 'city', 'state', 'zip_code', 'tier_id',
    ]
    for (const field of fields) {
      if (field in body) updates[field] = body[field]
    }
    if (Object.keys(updates).length === 0) throw new Error('No fields to update')
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message ?? 'Invalid body' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('partners')
    .update(updates)
    .eq('id', partnerId)
    .select('*, partner_tiers(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/partners/[id] — permanently delete a partner account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: partnerId } = await params
  const supabase = createServerSupabaseClient()

  // Delete from partners table first (FK constraint), then from auth.users
  const { error: dbError } = await supabase
    .from('partners')
    .delete()
    .eq('id', partnerId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  const { error: authError } = await supabase.auth.admin.deleteUser(partnerId)
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
