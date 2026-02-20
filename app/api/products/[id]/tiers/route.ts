import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

// PATCH /api/products/[id]/tiers — set which tiers can see a product
// Body: { visible_to_tiers: number[] | null }
// null or empty array = visible to all tiers (no restriction)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const productId = parseInt(id, 10)
  if (isNaN(productId)) {
    return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
  }

  let visibleToTiers: number[] | null
  try {
    const body = await request.json()
    if (body.visible_to_tiers === null || body.visible_to_tiers?.length === 0) {
      visibleToTiers = null
    } else if (Array.isArray(body.visible_to_tiers)) {
      visibleToTiers = body.visible_to_tiers.map(Number)
    } else {
      throw new Error('visible_to_tiers must be an array or null')
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message ?? 'Invalid body' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .update({ visible_to_tiers: visibleToTiers })
    .eq('id', productId)
    .select('id, name, visible_to_tiers')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
