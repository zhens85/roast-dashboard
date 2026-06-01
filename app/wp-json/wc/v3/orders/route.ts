/**
 * WooCommerce-compatible orders endpoint for Cropster integration.
 *
 * Setup:
 *  1. Add to Vercel env vars:
 *       WC_CONSUMER_KEY    — e.g.  ck_goodfolks_wholesale
 *       WC_CONSUMER_SECRET — any strong random string
 *  2. In Cropster → Settings → Shops → Add Integration → WooCommerce:
 *       Shop URL:         https://goodfolks.coffee
 *       Consumer Key:     (value of WC_CONSUMER_KEY)
 *       Consumer Secret:  (value of WC_CONSUMER_SECRET)
 *  3. Click Synchronize — Cropster will start importing confirmed orders.
 *
 * Only "confirmed" portal orders are exported (mapped to WC status
 * "processing"). SKUs on order items must match your Cropster product
 * catalog for roast profile linking.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { DashboardOrder } from '@/types'

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const key    = process.env.WC_CONSUMER_KEY
  const secret = process.env.WC_CONSUMER_SECRET
  if (!key || !secret) return false

  const { searchParams } = new URL(request.url)

  // WooCommerce query-param auth
  const qKey    = searchParams.get('consumer_key')
  const qSecret = searchParams.get('consumer_secret')
  if (qKey !== null && qSecret !== null) {
    return qKey === key && qSecret === secret
  }

  // HTTP Basic auth fallback
  const auth = request.headers.get('authorization') ?? ''
  if (auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf-8')
    const colon   = decoded.indexOf(':')
    if (colon === -1) return false
    return decoded.slice(0, colon) === key && decoded.slice(colon + 1) === secret
  }

  return false
}

// ── WooCommerce order mapper ──────────────────────────────────────────────────

function toWCOrder(order: DashboardOrder) {
  const p = order.partners
  const [firstName, ...rest] = (p?.contact_person ?? '').split(' ')
  const lastName = rest.join(' ')

  return {
    id:               order.id,
    number:           String(order.id),
    order_key:        `wc_order_${order.id}`,
    status:           'processing',   // "confirmed" in our system = ready to roast
    currency:         'USD',
    date_created:     order.created_at,
    date_modified:    order.created_at,
    date_created_gmt: order.created_at,
    date_modified_gmt:order.created_at,
    total:            (order.total_amount_cents / 100).toFixed(2),
    subtotal:         (order.total_amount_cents / 100).toFixed(2),
    total_tax:        '0.00',
    shipping_total:   '0.00',
    customer_note:    order.notes ?? '',
    payment_method:   'invoice',
    payment_method_title: 'Invoice',

    billing: {
      first_name: firstName,
      last_name:  lastName,
      company:    p?.company_name  ?? '',
      address_1:  p?.address       ?? '',
      city:       p?.city          ?? '',
      state:      p?.state         ?? '',
      postcode:   p?.zip_code      ?? '',
      country:    'US',
      email:      p?.email         ?? '',
      phone:      p?.phone         ?? '',
    },

    shipping: {
      first_name: firstName,
      last_name:  lastName,
      company:    p?.company_name  ?? '',
      address_1:  p?.address       ?? '',
      city:       p?.city          ?? '',
      state:      p?.state         ?? '',
      postcode:   p?.zip_code      ?? '',
      country:    'US',
    },

    line_items: order.order_items.map((item) => {
      const variant  = item.product_variants
      const name     = `${variant.products.name} ${variant.size}`
      const total    = item.unit_price_cents * item.quantity / 100
      return {
        id:           item.id,
        name,
        product_id:   variant.products.id,
        variation_id: 0,
        quantity:     item.quantity,
        sku:          variant.sku,
        price:        (item.unit_price_cents / 100).toFixed(2),
        subtotal:     total.toFixed(2),
        subtotal_tax: '0.00',
        total:        total.toFixed(2),
        total_tax:    '0.00',
        taxes:        [],
        meta_data:    [],
      }
    }),

    tax_lines:    [],
    shipping_lines: [],
    fee_lines:    [],
    coupon_lines: [],
    meta_data:    [],
  }
}

// ── GET /wp-json/wc/v3/orders ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { code: 'woocommerce_rest_cannot_view', message: 'Unauthorized' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const perPage  = Math.min(parseInt(searchParams.get('per_page') ?? '100', 10), 100)
  const page     = Math.max(parseInt(searchParams.get('page')     ?? '1',   10), 1)
  const after    = searchParams.get('after')  ?? null  // ISO date string
  const before   = searchParams.get('before') ?? null
  // WC "processing" = our "confirmed"; ignore other status filters
  const wcStatus = searchParams.get('status') ?? 'processing'

  // Only export confirmed portal orders (ignore any non-processing requests)
  if (wcStatus !== 'processing' && wcStatus !== 'any') {
    return NextResponse.json([])
  }

  const supabase = createServerSupabaseClient()

  let query = supabase
    .from('orders')
    .select(`
      *,
      partners ( id, company_name, email, contact_person, phone, address, city, state, zip_code ),
      order_items (
        *,
        product_variants (
          id, sku, size, product_id,
          products ( id, name )
        )
      )
    `)
    .eq('status', 'confirmed')
    .eq('source', 'portal')
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  if (after)  query = query.gte('created_at', after)
  if (before) query = query.lte('created_at', before)

  const { data, error } = await query

  if (error) {
    console.error('[WC bridge] DB error:', error.message)
    return NextResponse.json(
      { code: 'woocommerce_rest_invalid_query', message: error.message },
      { status: 500 }
    )
  }

  const orders = ((data ?? []) as DashboardOrder[]).map(toWCOrder)

  return NextResponse.json(orders, {
    headers: {
      'X-WP-Total':      String(orders.length),
      'X-WP-TotalPages': '1',
    },
  })
}
