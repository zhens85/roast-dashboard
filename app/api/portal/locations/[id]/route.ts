import { NextRequest, NextResponse } from 'next/server'
import { createPortalSupabaseClient } from '@/lib/supabase-portal'

// PATCH /api/portal/locations/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createPortalSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const locationId = parseInt(id, 10)
  if (isNaN(locationId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await request.json()
  const isDefault = Boolean(body.is_default)

  // Promote to default: clear any existing default for this partner first
  if (isDefault) {
    await supabase
      .from('partner_locations')
      .update({ is_default: false })
      .eq('partner_id', user.id)
      .neq('id', locationId)
  }

  const updates: Record<string, unknown> = {}
  const fields = ['name', 'contact_person', 'phone', 'address', 'city', 'state', 'zip_code']
  for (const f of fields) {
    if (f in body) updates[f] = body[f]?.toString().trim() || null
  }
  if ('is_default' in body) updates.is_default = isDefault
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }
  if (updates.name !== undefined && !updates.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  // RLS ensures the partner can only update their own locations
  const { data, error } = await supabase
    .from('partner_locations')
    .update(updates)
    .eq('id', locationId)
    .eq('partner_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' },  { status: 404 })
  return NextResponse.json(data)
}

// DELETE /api/portal/locations/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createPortalSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const locationId = parseInt(id, 10)
  if (isNaN(locationId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const { error } = await supabase
    .from('partner_locations')
    .delete()
    .eq('id', locationId)
    .eq('partner_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: locationId })
}
