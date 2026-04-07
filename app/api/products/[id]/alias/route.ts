import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

// PUT /api/products/[id]/alias
// Sets (or updates) this product's canonical alias mapping.
// Body: { canonical_product_id: number }
// A product that already has other products aliasing TO it cannot itself be aliased.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const aliasProductId = parseInt(id, 10)
  if (isNaN(aliasProductId)) {
    return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
  }

  let canonicalProductId: number
  try {
    const body = await request.json()
    canonicalProductId = parseInt(body.canonical_product_id, 10)
    if (isNaN(canonicalProductId)) throw new Error('canonical_product_id must be a number')
    if (canonicalProductId === aliasProductId) throw new Error('A product cannot alias itself')
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message ?? 'Invalid body' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // Guard: prevent aliasing a product that is itself a canonical target
  // (i.e., other products already alias to this product).
  // This keeps alias resolution to one level deep.
  const { count } = await supabase
    .from('product_aliases')
    .select('*', { count: 'exact', head: true })
    .eq('canonical_product_id', aliasProductId)

  if (count && count > 0) {
    return NextResponse.json(
      { error: 'This product is already a canonical target — it cannot itself be aliased.' },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .from('product_aliases')
    .upsert(
      { alias_product_id: aliasProductId, canonical_product_id: canonicalProductId },
      { onConflict: 'alias_product_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/products/[id]/alias
// Removes this product's alias mapping, making it a standalone product again.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const aliasProductId = parseInt(id, 10)
  if (isNaN(aliasProductId)) {
    return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from('product_aliases')
    .delete()
    .eq('alias_product_id', aliasProductId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
