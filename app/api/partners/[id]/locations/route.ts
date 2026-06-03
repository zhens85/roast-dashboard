import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

// GET /api/partners/[id]/locations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthenticated(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('partner_locations')
    .select('*')
    .eq('partner_id', id)
    .order('is_default', { ascending: false })
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/partners/[id]/locations
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthenticated(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: partnerId } = await params
  const body = await request.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  if (body.is_default) {
    await supabase.from('partner_locations').update({ is_default: false }).eq('partner_id', partnerId)
  }
  const { data, error } = await supabase
    .from('partner_locations')
    .insert({
      partner_id:     partnerId,
      name:           body.name.trim(),
      contact_person: body.contact_person?.trim() || null,
      phone:          body.phone?.trim()           || null,
      address:        body.address?.trim()         || null,
      city:           body.city?.trim()            || null,
      state:          body.state?.trim()           || null,
      zip_code:       body.zip_code?.trim()        || null,
      is_default:     Boolean(body.is_default),
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
