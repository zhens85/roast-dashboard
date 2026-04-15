import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

// POST /api/orders/delete — permanently delete selected orders and their items
export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let orderIds: number[]
  try {
    const body = await request.json()
    if (!Array.isArray(body.orderIds) || body.orderIds.length === 0) {
      throw new Error('orderIds must be a non-empty array')
    }
    orderIds = body.orderIds.map(Number)
  } catch (e: unknown) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Invalid body' },
      { status: 400 }
    )
  }

  const supabase = createServerSupabaseClient()

  // Delete order items first (foreign key constraint)
  const { error: itemsError } = await supabase
    .from('order_items')
    .delete()
    .in('order_id', orderIds)

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 })
  }

  // Delete the orders
  const { error: ordersError } = await supabase
    .from('orders')
    .delete()
    .in('id', orderIds)

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: orderIds })
}
