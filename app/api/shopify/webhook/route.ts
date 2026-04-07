/**
 * Shopify Webhook Handler
 *
 * Receives order webhooks from Shopify and imports them into the roast
 * dashboard as pending orders, ready to include in the roast schedule.
 *
 * Supported topics (set in Shopify Admin > Settings > Notifications > Webhooks):
 *   orders/create  — new order placed
 *   orders/paid    — order payment confirmed (good alternative trigger)
 *   orders/cancelled — cancel the order in our DB if it was imported
 *
 * Setup:
 *   1. Add SHOPIFY_WEBHOOK_SECRET to Vercel environment variables.
 *      (Shopify Admin → Settings → Notifications → Webhooks → show secret)
 *   2. Create webhooks in Shopify pointing to:
 *        https://goodfolks.coffee/api/shopify/webhook
 *
 * SKU matching:
 *   Line items are matched to product_variants by SKU.
 *   Make sure your Shopify product variants have SKUs that match exactly
 *   what's in the dashboard (e.g. BL-DAYTRIPPER-12WB).
 *   Unmatched line items are skipped with a console warning.
 *   If NO items match at all, the order is not imported.
 */

import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// ── Shopify payload types ─────────────────────────────────────────────────────

interface ShopifyAddress {
  name:         string | null
  first_name:   string | null
  last_name:    string | null
  company:      string | null
  address1:     string | null
  address2:     string | null
  city:         string | null
  province_code: string | null
  zip:          string | null
  country_code: string | null
  phone:        string | null
}

interface ShopifyLineItem {
  id:            number
  title:         string
  variant_title: string | null
  sku:           string | null
  quantity:      number
  price:         string        // decimal string e.g. "11.50"
  product_id:    number | null
  variant_id:    number | null
}

interface ShopifyOrder {
  id:               number           // Shopify order DB id
  order_number:     number           // human-readable number e.g. 1001
  email:            string | null
  created_at:       string
  note:             string | null
  total_price:      string           // decimal string e.g. "45.00"
  financial_status: string           // paid | pending | voided etc.
  cancelled_at:     string | null
  shipping_address: ShopifyAddress | null
  billing_address:  ShopifyAddress | null
  line_items:       ShopifyLineItem[]
}

// ── HMAC verification ─────────────────────────────────────────────────────────

function verifyShopifyHmac(rawBody: string, signature: string, secret: string): boolean {
  const computed = createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64')
  // Timing-safe comparison
  const a = Buffer.from(computed)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i]
  return mismatch === 0
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET
  if (!secret) {
    console.error('[Shopify webhook] SHOPIFY_WEBHOOK_SECRET env var not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // Read raw body for HMAC verification BEFORE parsing JSON.
  const rawBody = await request.text()

  // Verify the request genuinely came from Shopify.
  const signature = request.headers.get('x-shopify-hmac-sha256') ?? ''
  if (!verifyShopifyHmac(rawBody, signature, secret)) {
    console.warn('[Shopify webhook] HMAC verification failed — rejecting request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const topic = request.headers.get('x-shopify-topic') ?? ''
  console.log(`[Shopify webhook] topic=${topic}`)

  let order: ShopifyOrder
  try {
    order = JSON.parse(rawBody) as ShopifyOrder
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Handle cancellation
  if (topic === 'orders/cancelled') {
    return handleCancelled(order)
  }

  // Handle creation / payment confirmation
  if (topic === 'orders/create' || topic === 'orders/paid') {
    return handleCreate(order)
  }

  // Unknown topic — return 200 so Shopify doesn't retry
  return NextResponse.json({ ignored: true }, { status: 200 })
}

// ── Order creation ─────────────────────────────────────────────────────────────

async function handleCreate(shopifyOrder: ShopifyOrder): Promise<NextResponse> {
  const externalId = `shopify_${shopifyOrder.id}`
  const supabase   = createServerSupabaseClient()

  // Idempotency — skip if already imported
  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('external_id', externalId)
    .maybeSingle()

  if (existing) {
    console.log(`[Shopify webhook] order ${shopifyOrder.id} already imported (order #${existing.id}) — skipping`)
    return NextResponse.json({ skipped: true, reason: 'already_imported' }, { status: 200 })
  }

  // ── Match line items to product_variants by SKU ──────────────────────────
  const skus = shopifyOrder.line_items
    .map(i => i.sku?.trim().toUpperCase())
    .filter(Boolean) as string[]

  if (skus.length === 0) {
    console.warn(`[Shopify webhook] order ${shopifyOrder.order_number}: no SKUs on any line items — skipping`)
    return NextResponse.json({ skipped: true, reason: 'no_skus' }, { status: 200 })
  }

  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, sku, price_cents')
    .in('sku', skus)

  const variantBySku = Object.fromEntries(
    (variants ?? []).map(v => [v.sku.toUpperCase(), v])
  )

  // Build matched order items
  interface MatchedItem {
    product_variant_id: number
    quantity:           number
    unit_price_cents:   number
  }
  const matchedItems: MatchedItem[] = []
  let totalCents = 0

  for (const lineItem of shopifyOrder.line_items) {
    const sku     = lineItem.sku?.trim().toUpperCase()
    const variant = sku ? variantBySku[sku] : undefined

    if (!variant) {
      console.warn(
        `[Shopify webhook] order ${shopifyOrder.order_number}: ` +
        `no variant match for SKU "${lineItem.sku}" (${lineItem.title}) — skipping item`
      )
      continue
    }

    // Use Shopify's price at time of order (honours any sale/discount)
    const unitCents = Math.round(parseFloat(lineItem.price) * 100)
    matchedItems.push({
      product_variant_id: variant.id,
      quantity:           lineItem.quantity,
      unit_price_cents:   unitCents,
    })
    totalCents += unitCents * lineItem.quantity
  }

  if (matchedItems.length === 0) {
    console.warn(
      `[Shopify webhook] order ${shopifyOrder.order_number}: ` +
      `no line items matched any product variants — order not imported`
    )
    return NextResponse.json({ skipped: true, reason: 'no_matching_items' }, { status: 200 })
  }

  // ── Match customer email to a partner account ────────────────────────────
  const customerEmail = shopifyOrder.email?.toLowerCase().trim() ?? null
  let partnerId: string | null = null

  if (customerEmail) {
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('email', customerEmail)
      .maybeSingle()
    partnerId = partner?.id ?? null
  }

  // ── Resolve customer display name ────────────────────────────────────────
  const addr         = shopifyOrder.shipping_address ?? shopifyOrder.billing_address
  const customerName = addr?.company
    ?? addr?.name
    ?? [addr?.first_name, addr?.last_name].filter(Boolean).join(' ')
    || shopifyOrder.email
    || `Shopify #${shopifyOrder.order_number}`

  // ── Build shipping address snapshot ─────────────────────────────────────
  const shippingAddress = addr ? {
    name:          addr.name,
    company:       addr.company,
    address1:      addr.address1,
    address2:      addr.address2,
    city:          addr.city,
    province_code: addr.province_code,
    zip:           addr.zip,
    country_code:  addr.country_code,
    phone:         addr.phone,
  } : null

  // ── Insert the order ─────────────────────────────────────────────────────
  const orderInsert: Record<string, unknown> = {
    status:             'pending',
    source:             'shopify',
    external_id:        externalId,
    total_amount_cents: totalCents,
    notes:              shopifyOrder.note ?? null,
    customer_name:      partnerId ? null : customerName,  // redundant if partner matched
    customer_email:     partnerId ? null : customerEmail,
    shipping_address:   shippingAddress,
    created_at:         shopifyOrder.created_at,
  }

  // Only set partner_id if we found a matching partner
  if (partnerId) orderInsert.partner_id = partnerId

  const { data: newOrder, error: orderError } = await supabase
    .from('orders')
    .insert(orderInsert)
    .select('id')
    .single()

  if (orderError || !newOrder) {
    console.error('[Shopify webhook] failed to insert order:', orderError)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }

  // ── Insert order items ───────────────────────────────────────────────────
  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(matchedItems.map(item => ({ ...item, order_id: newOrder.id })))

  if (itemsError) {
    console.error('[Shopify webhook] failed to insert order items:', itemsError)
    // Roll back the order to avoid orphaned records
    await supabase.from('orders').delete().eq('id', newOrder.id)
    return NextResponse.json({ error: 'Failed to create order items' }, { status: 500 })
  }

  const partnerStatus = partnerId ? `partner matched (${partnerId})` : 'no partner match — stored as customer'
  console.log(
    `[Shopify webhook] imported order ${shopifyOrder.order_number} → ` +
    `dashboard order #${newOrder.id} | ` +
    `${matchedItems.length} item(s) | ${partnerStatus}`
  )

  return NextResponse.json({ imported: true, orderId: newOrder.id }, { status: 200 })
}

// ── Order cancellation ────────────────────────────────────────────────────────

async function handleCancelled(shopifyOrder: ShopifyOrder): Promise<NextResponse> {
  const externalId = `shopify_${shopifyOrder.id}`
  const supabase   = createServerSupabaseClient()

  const { data: existing } = await supabase
    .from('orders')
    .select('id, status')
    .eq('external_id', externalId)
    .maybeSingle()

  if (!existing) {
    // Never imported — nothing to do
    return NextResponse.json({ skipped: true, reason: 'not_found' }, { status: 200 })
  }

  // Only cancel if the order hasn't already shipped
  if (existing.status === 'shipped' || existing.status === 'delivered') {
    console.warn(
      `[Shopify webhook] order ${shopifyOrder.order_number} cancelled in Shopify ` +
      `but already ${existing.status} in dashboard — not auto-cancelling`
    )
    return NextResponse.json({ skipped: true, reason: 'already_shipped' }, { status: 200 })
  }

  const { error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', existing.id)

  if (error) {
    console.error('[Shopify webhook] failed to cancel order:', error)
    return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 })
  }

  console.log(`[Shopify webhook] cancelled dashboard order #${existing.id} (Shopify #${shopifyOrder.order_number})`)
  return NextResponse.json({ cancelled: true, orderId: existing.id }, { status: 200 })
}
