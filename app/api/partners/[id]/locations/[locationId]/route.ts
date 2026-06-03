import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

// PATCH /api/partners/[id]/locations/[locationId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> },
) {
  if (!isAuthenticated(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: partnerId, locationId } = await params
  const locId = parseInt(locationId, 10)
  if (isNaN(locId)) return NextResponse.json({ error: 'Invalid location id' }, { status: 400 })

  const body = await request.json()
  const supabase = createServerSupabaseClient()

  if (body.is_default) {
    await supabase.from('partner_locations').update({ is_default: false })
      .eq('partner_id', partnerId).neq('id', locId)
  }

  const updates: Record<string, unknown> = {}
  const fields = ['name', 'contact_person', 'phone', 'address', 'city', 'state', 'zip_code']
  for (const f of fields) {
    if (f in body) updates[f] = body[f]?.toString().trim() || null
  }
  if ('is_default' in body) updates.is_default = Boolean(body.is_default)

  const { data, error } = await supabase
    .from('partner_locations')
    .update(updates)
    .eq('id', locId)
    .eq('partner_id', partnerId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/partners/[id]/locations/[locationId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; locationId: string }> },
) {
  if (!isAuthenticated(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: partnerId, locationId } = await params
  const locId = parseInt(locationId, 10)
  if (isNaN(locId)) return NextResponse.json({ error: 'Invalid location id' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { error } = await supabase.from('partner_locations').delete()
    .eq('id', locId).eq('partner_id', partnerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: locId })
}
