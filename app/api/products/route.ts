import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

// POST /api/products — create a new product
export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
    if (!body.name?.toString().trim()) throw new Error('name is required')
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message ?? 'Invalid body' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .insert({
      name:              body.name,
      description:       body.description       ?? null,
      origin_region:     body.origin_region      ?? null,
      roast_level:       body.roast_level        ?? null,
      process_method:    body.process_method     ?? null,
      image_url:         body.image_url          ?? null,
      roast_loss_factor: body.roast_loss_factor  ?? 0.15,
      is_active:         body.is_active          ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
