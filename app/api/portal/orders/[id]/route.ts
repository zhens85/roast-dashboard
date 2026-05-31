import { NextRequest, NextResponse } from 'next/server'
import { createPortalSupabaseClient } from '@/lib/supabase-portal'

// Sentinel date used to mark a recurring order as "paused".
// The existing scheduled_for filter (lte.TODAY) already excludes it from
// the admin dashboard and ShipStation — no extra column needed.
const PAUSED_DATE = '2099-01-01'

async function getOrderForPartner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orderId: number,
  userId: string,
) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        *,
        product_variants (
          *,
          products ( id, name )
        )
      )
    `)
    .eq('id', orderId)
    .eq('partner_id', userId)
    .single()
  if (error || !data) return null
  return data
}

// PATCH /api/portal/orders/[id]
// Body must include `action`:
//   { action: 'edit',       notes: string, items: { id, quantity }[] }
//   { action: 'reschedule', scheduled_for: string }   // YYYY-MM-DD
//   { action: 'pause' }
//   { action: 'resume',     scheduled_for: string }   // YYYY-MM-DD
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createPortalSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const orderId = parseInt(id, 10)
  if (isNaN(orderId)) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })
  }

  const order = await getOrderForPartner(supabase, orderId, user.id)
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.status !== 'pending') {
    return NextResponse.json(
      { error: 'Only pending orders can be modified' },
      { status: 400 },
    )
  }

  const body = await request.json()
  const { action } = body

  if (action === 'edit') {
    const { notes, items } = body

    if (Array.isArray(items)) {
      for (const { id: itemId, quantity } of items) {
        if (quantity <= 0) {
          await supabase
            .from('order_items')
            .delete()
            .eq('id', itemId)
            .eq('order_id', orderId)
        } else {
          await supabase
            .from('order_items')
            .update({ quantity })
            .eq('id', itemId)
            .eq('order_id', orderId)
        }
      }
    }

    // Recalculate total from whatever items remain
    const { data: remaining } = await supabase
      .from('order_items')
      .select('quantity, unit_price_cents')
      .eq('order_id', orderId)

    const newTotal = (remaining ?? []).reduce(
      (sum: number, item: { quantity: number; unit_price_cents: number }) =>
        sum + item.quantity * item.unit_price_cents,
      0,
    )

    const { error: updateErr } = await supabase
      .from('orders')
      .update({ notes: notes ?? null, total_amount_cents: newTotal })
      .eq('id', orderId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
  }

  else if (action === 'pause') {
    const { error: updateErr } = await supabase
      .from('orders')
      .update({ scheduled_for: PAUSED_DATE })
      .eq('id', orderId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
  }

  else if (action === 'resume' || action === 'reschedule') {
    const date: string = body.scheduled_for
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }
    const { error: updateErr } = await supabase
      .from('orders')
      .update({ scheduled_for: date })
      .eq('id', orderId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
  }

  else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const updated = await getOrderForPartner(supabase, orderId, user.id)
  return NextResponse.json(updated)
}

// DELETE /api/portal/orders/[id]
// Only the owning partner can delete; order must be pending.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createPortalSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const orderId = parseInt(id, 10)
  if (isNaN(orderId)) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 })
  }

  const order = await getOrderForPartner(supabase, orderId, user.id)
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.status !== 'pending') {
    return NextResponse.json(
      { error: 'Only pending orders can be deleted' },
      { status: 400 },
    )
  }

  // Items cascade-delete via FK, but let's be explicit
  await supabase.from('order_items').delete().eq('order_id', orderId)
  const { error: delErr } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId)

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: orderId })
}
