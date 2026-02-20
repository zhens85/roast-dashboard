import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

// PATCH /api/variants/[id] — update a variant's price, SKU, or availability
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const variantId = parseInt(id, 10)
  if (isNaN(variantId)) {
    return NextResponse.json({ error: 'Invalid variant id' }, { status: 400 })
  }

  let updates: Record<string, unknown>
  try {
    const body = await request.json()
    updates = {}
    if ('price_cents'  in body) updates.price_cents  = body.price_cents
    if ('sku'          in body) updates.sku          = body.sku
    if ('is_available' in body) updates.is_available = body.is_available
    if (Object.keys(updates).length === 0) throw new Error('No fields to update')
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message ?? 'Invalid body' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('product_variants')
    .update(updates)
    .eq('id', variantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/variants/[id] — permanently delete a variant
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const variantId = parseInt(id, 10)
  if (isNaN(variantId)) {
    return NextResponse.json({ error: 'Invalid variant id' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from('product_variants')
    .delete()
    .eq('id', variantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: variantId })
}
