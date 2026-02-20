import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

// POST /api/orders/cancel — mark selected pending orders as 'cancelled'
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
  const { error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .in('id', orderIds)
    .eq('status', 'pending')   // only cancel if still pending

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ cancelled: orderIds })
}
