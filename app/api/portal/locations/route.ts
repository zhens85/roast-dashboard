import { NextRequest, NextResponse } from 'next/server'
import { createPortalSupabaseClient } from '@/lib/supabase-portal'

// GET /api/portal/locations — list the current partner's locations
export async function GET() {
  const supabase = await createPortalSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('partner_locations')
    .select('*')
    .eq('partner_id', user.id)
    .order('is_default', { ascending: false })
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/portal/locations — create a new location
export async function POST(request: NextRequest) {
  const supabase = await createPortalSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
    if (!body.name?.toString().trim()) throw new Error('name is required')
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  const isDefault = Boolean(body.is_default)

  // If this will be the default, clear any existing default first
  if (isDefault) {
    await supabase
      .from('partner_locations')
      .update({ is_default: false })
      .eq('partner_id', user.id)
  }

  const { data, error } = await supabase
    .from('partner_locations')
    .insert({
      partner_id:     user.id,
      name:           String(body.name).trim(),
      contact_person: body.contact_person?.toString().trim() || null,
      phone:          body.phone?.toString().trim()          || null,
      address:        body.address?.toString().trim()        || null,
      city:           body.city?.toString().trim()           || null,
      state:          body.state?.toString().trim()          || null,
      zip_code:       body.zip_code?.toString().trim()       || null,
      is_default:     isDefault,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
