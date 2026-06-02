import { NextRequest, NextResponse } from 'next/server'
import { createPortalSupabaseClient } from '@/lib/supabase-portal'
import { sendOrderNotificationEmail } from '@/lib/email'
import type { CartItem } from '@/types'

export async function POST(request: NextRequest) {
  const supabase = await createPortalSupabaseClient()

  // Verify the user is authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const VALID_INTERVALS = ['weekly', 'biweekly', 'monthly', 'every_6_weeks', 'every_8_weeks']

  // Parse request body
  let items: CartItem[]
  let notes: string | null
  let is_recurring: boolean
  let recurring_interval: string | null
  let scheduled_for: string | null
  let location_id: number | null
  try {
    const body = await request.json()
    items              = body.items
    notes              = body.notes || null
    is_recurring       = Boolean(body.is_recurring)
    recurring_interval = is_recurring ? (body.recurring_interval || null) : null
    // scheduled_for: ISO date string YYYY-MM-DD, only meaningful for recurring orders
    scheduled_for      = is_recurring ? (body.scheduled_for || null) : null
    location_id        = body.location_id ? Number(body.location_id) : null

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('items must be a non-empty array')
    }
    if (is_recurring && recurring_interval && !VALID_INTERVALS.includes(recurring_interval)) {
      throw new Error('Invalid recurring_interval')
    }
    // Basic date format validation
    if (scheduled_for && !/^\d{4}-\d{2}-\d{2}$/.test(scheduled_for)) {
      throw new Error('Invalid scheduled_for date format')
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Calculate order total from the cart items (prices are already discounted)
  const totalAmountCents = items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0
  )

  // Phase 1: Insert the order header
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      partner_id:          user.id,
      status:              'pending',
      total_amount_cents:  totalAmountCents,
      notes,
      is_recurring,
      recurring_interval,
      scheduled_for,
      location_id,
    })
    .select('id')
    .single()

  if (orderError || !order) {
    console.error('Error inserting order:', orderError)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }

  // Phase 2: Insert all order items
  const orderItems = items.map((item) => ({
    order_id:            order.id,
    product_variant_id:  item.variantId,
    quantity:            item.quantity,
    unit_price_cents:    item.unitPriceCents,
  }))

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems)

  if (itemsError) {
    console.error('Error inserting order items:', itemsError)
    // Order header was created but items failed — log for investigation
    return NextResponse.json({ error: 'Failed to create order items' }, { status: 500 })
  }

  // Send order notification email only for orders that are ready now.
  // Future-dated orders are held until their scheduled_for date — no email yet.
  const todayStr = new Date().toISOString().split('T')[0]
  const isFutureOrder = scheduled_for && scheduled_for > todayStr

  if (!isFutureOrder)
  try {
    await sendOrderNotificationEmail(order.id)
  } catch (err) {
    console.error(`Order notification email failed for order ${order.id}:`, err)
  }

  return NextResponse.json({ orderId: order.id, is_recurring, recurring_interval, scheduled_for }, { status: 201 })
}
