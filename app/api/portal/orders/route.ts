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

  // Parse request body
  let items: CartItem[]
  let notes: string | null
  try {
    const body = await request.json()
    items = body.items
    notes = body.notes || null

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('items must be a non-empty array')
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

  // Send order notification email — awaited so Vercel doesn't terminate the
  // function before the email is dispatched. Errors are caught and logged so
  // a Resend failure never blocks the partner's order confirmation.
  let emailError: string | null = null
  try {
    await sendOrderNotificationEmail(order.id)
  } catch (err) {
    emailError = (err as Error).message
    console.error(`Order notification email failed for order ${order.id}:`, err)
  }

  return NextResponse.json({ orderId: order.id, emailError }, { status: 201 })
}
