import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { createQBOInvoiceForOrder } from '@/lib/quickbooks'

// Advance a YYYY-MM-DD date by the recurring interval.
function nextOccurrenceDate(dateISO: string, interval: string | null): string {
  const d = new Date(dateISO + 'T12:00:00Z')
  switch (interval) {
    case 'weekly':        d.setUTCDate(d.getUTCDate() + 7);   break
    case 'monthly':       d.setUTCMonth(d.getUTCMonth() + 1); break
    case 'every_6_weeks': d.setUTCDate(d.getUTCDate() + 42);  break
    case 'every_8_weeks': d.setUTCDate(d.getUTCDate() + 56);  break
    default:              d.setUTCDate(d.getUTCDate() + 14);  break // biweekly
  }
  return d.toISOString().split('T')[0]
}

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

  // Fetch the full order records before confirming so we have the recurring fields
  const { data: ordersToConfirm } = await supabase
    .from('orders')
    .select(`
      id, partner_id, total_amount_cents, notes,
      is_recurring, recurring_interval, scheduled_for,
      order_items ( product_variant_id, quantity, unit_price_cents )
    `)
    .in('id', orderIds)
    .eq('status', 'pending')

  // Confirm all pending orders in the batch
  const { error } = await supabase
    .from('orders')
    .update({ status: 'confirmed' })
    .in('id', orderIds)
    .eq('status', 'pending')

  if (error) {
    console.error('Supabase error confirming orders:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // For each confirmed recurring order, spin up the next occurrence as a
  // fresh order record. Postgres assigns the next sequential id automatically,
  // so ShipStation always receives a unique order number regardless of other
  // orders placed by other customers in the meantime.
  const recurringOrders = (ordersToConfirm ?? []).filter(
    (o) => o.is_recurring && o.partner_id && o.scheduled_for
  )

  for (const order of recurringOrders) {
    const nextDate = nextOccurrenceDate(order.scheduled_for!, order.recurring_interval)

    const { data: newOrder, error: insertErr } = await supabase
      .from('orders')
      .insert({
        partner_id:         order.partner_id,
        status:             'pending',
        total_amount_cents: order.total_amount_cents,
        notes:              order.notes ?? null,
        is_recurring:       true,
        recurring_interval: order.recurring_interval,
        scheduled_for:      nextDate,
      })
      .select('id')
      .single()

    if (insertErr || !newOrder) {
      // Log but don't fail the whole confirm — the current order is already confirmed
      console.error(
        `Failed to create next occurrence for recurring order ${order.id}:`,
        insertErr?.message
      )
      continue
    }

    // Copy all line items to the new order
    const items = (order.order_items ?? []).map(
      (item: { product_variant_id: number; quantity: number; unit_price_cents: number }) => ({
        order_id:           newOrder.id,
        product_variant_id: item.product_variant_id,
        quantity:           item.quantity,
        unit_price_cents:   item.unit_price_cents,
      })
    )

    if (items.length > 0) {
      const { error: itemsErr } = await supabase.from('order_items').insert(items)
      if (itemsErr) {
        console.error(
          `Failed to copy items for new recurring order ${newOrder.id}:`,
          itemsErr.message
        )
      }
    }

    console.log(
      `Recurring order ${order.id} confirmed → next occurrence created as order ${newOrder.id} ` +
      `(scheduled_for: ${nextDate})`
    )
  }

  // Create QBO invoices for all confirmed orders (fire-and-forget — never blocks confirm)
  for (const id of orderIds) {
    createQBOInvoiceForOrder(id).catch((err) =>
      console.error(`[QBO] Invoice failed for order ${id}:`, err)
    )
  }

  return NextResponse.json({ confirmed: orderIds.length })
}
