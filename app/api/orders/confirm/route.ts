import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  // API routes need their own auth check — middleware only covers page routes
  const sessionCookie = request.cookies.get('roast_session')
  if (sessionCookie?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let orderIds: number[]
  try {
    const body = await request.json()
    orderIds = body.orderIds
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      throw new Error('orderIds must be a non-empty array')
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  const { error } = await supabase
    .from('orders')
    .update({ status: 'confirmed' })
    .in('id', orderIds)
    .eq('status', 'pending')  // Safety: only update orders still pending

  if (error) {
    console.error('Supabase error confirming orders:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ confirmed: orderIds.length })
}
