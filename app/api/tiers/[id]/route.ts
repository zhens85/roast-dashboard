import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

// PATCH /api/tiers/[id] — update a tier's name and/or discount_pct
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const tierId = parseInt(id, 10)
  if (isNaN(tierId)) {
    return NextResponse.json({ error: 'Invalid tier id' }, { status: 400 })
  }

  let name: string
  try {
    const body = await request.json()
    name = body.name?.trim()
    if (!name) throw new Error('name is required')
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message ?? 'Invalid body' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('partner_tiers')
    .update({ name })
    .eq('id', tierId)
    .select('*, tier_discount_rules(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/tiers/[id] — delete a tier
// Partners assigned to this tier will have their tier_id set to NULL (ON DELETE SET NULL)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const tierId = parseInt(id, 10)
  if (isNaN(tierId)) {
    return NextResponse.json({ error: 'Invalid tier id' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from('partner_tiers')
    .delete()
    .eq('id', tierId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: tierId })
}
