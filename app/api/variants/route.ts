import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

// POST /api/variants — create a new product variant
export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
    if (!body.product_id)  throw new Error('product_id is required')
    if (!body.size)        throw new Error('size is required')
    if (!body.price_cents) throw new Error('price_cents is required')
    if (!body.sku)         throw new Error('sku is required')
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message ?? 'Invalid body' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('product_variants')
    .insert({
      product_id:   body.product_id,
      size:         body.size,
      price_cents:  body.price_cents,
      sku:          body.sku,
      is_available: body.is_available ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
