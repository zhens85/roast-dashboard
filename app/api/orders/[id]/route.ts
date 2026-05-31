import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

const PAUSED_DATE = '2099-01-01'

const VALID_INTERVALS = [
  'weekly', 'biweekly', 'monthly', 'every_6_weeks', 'every_8_weeks',
] as const

// PATCH /api/orders/[id]
// Admin endpoint — edit order contents, schedule, and recurring settings.
// Body: {
//   notes?:              string | null
//   scheduled_for?:      string | null   (YYYY-MM-DD, or null to clear)
//   recurring_interval?: string
//   items?:              { id: number, quantity: number }[]
//   action?:             'pause' | 'resume'  (shorthand helpers)
// }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const orderId = parseInt(id, 10)
  if (isNaN(orderId)) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })
  }

  const body = await request.json()
  const supabase = createServerSupabaseClient()

  // Shorthand actions
  if (body.action === 'pause') {
    const { error } = await supabase
      .from('orders')
      .update({ scheduled_for: PAUSED_DATE })
      .eq('id', orderId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return fetchAndReturn(supabase, orderId)
  }

  if (body.action === 'resume') {
    const date: string = body.scheduled_for
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'scheduled_for required for resume' }, { status: 400 })
    }
    const { error } = await supabase
      .from('orders')
      .update({ scheduled_for: date })
      .eq('id', orderId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return fetchAndReturn(supabase, orderId)
  }

  // Full edit
  const updates: Record<string, unknown> = {}

  if ('notes' in body)         updates.notes         = body.notes ?? null
  if ('scheduled_for' in body) updates.scheduled_for = body.scheduled_for ?? null
  if ('recurring_interval' in body) {
    const interval = body.recurring_interval
    if (interval && !VALID_INTERVALS.includes(interval)) {
      return NextResponse.json({ error: 'Invalid recurring_interval' }, { status: 400 })
    }
    updates.recurring_interval = interval ?? null
  }

  // Item quantity changes
  if (Array.isArray(body.items)) {
    for (const { id: itemId, quantity } of body.items as { id: number; quantity: number }[]) {
      if (quantity <= 0) {
        await supabase.from('order_items').delete().eq('id', itemId).eq('order_id', orderId)
      } else {
        await supabase.from('order_items').update({ quantity }).eq('id', itemId).eq('order_id', orderId)
      }
    }

    // Recalculate total
    const { data: remaining } = await supabase
      .from('order_items')
      .select('quantity, unit_price_cents')
      .eq('order_id', orderId)

    updates.total_amount_cents = (remaining ?? []).reduce(
      (sum: number, item: { quantity: number; unit_price_cents: number }) =>
        sum + item.quantity * item.unit_price_cents,
      0,
    )
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return fetchAndReturn(supabase, orderId)
}

async function fetchAndReturn(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orderId: number,
) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      partners ( id, company_name, email, contact_person, phone ),
      order_items (
        *,
        product_variants ( *, products ( id, name ) )
      )
    `)
    .eq('id', orderId)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
