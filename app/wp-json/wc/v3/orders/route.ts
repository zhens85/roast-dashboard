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

// WooCommerce expects "YYYY-MM-DDTHH:MM:SS" — no microseconds, no timezone offset.
function wcDate(iso: string): string {
  return new Date(iso).toISOString().replace(/\.\d{3}Z$/, '').replace('Z', '')
}

function toWCOrder(order: DashboardOrder) {
  const p   = order.partners
  const loc = order.partner_locations ?? null
  const [firstName, ...rest] = ((loc?.contact_person ?? p?.contact_person) ?? '').split(' ')
  const lastName = rest.join(' ')

  return {
    id:               order.id,
    number:           String(order.id),
    order_key:        `wc_order_${order.id}`,
    // pending → on-hold (received, awaiting admin review)
    // confirmed → processing (admin-confirmed, ready to roast/ship)
    status:           order.status === 'confirmed' ? 'processing' : 'on-hold',
    currency:         'USD',
    date_created:     wcDate(order.created_at),
    date_modified:    wcDate(order.created_at),
    date_created_gmt: wcDate(order.created_at),
    date_modified_gmt:wcDate(order.created_at),
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
      company:    loc?.name ?? p?.company_name ?? '',
      address_1:  loc?.address  ?? p?.address  ?? '',
      city:       loc?.city     ?? p?.city     ?? '',
      state:      loc?.state    ?? p?.state    ?? '',
      postcode:   loc?.zip_code ?? p?.zip_code ?? '',
      country:    'US',
    },

    line_items: order.order_items.map((item) => {
      const variant  = item.product_variants
      const name     = `${variant.products.name} ${variant.size}`
      const total    = item.unit_price_cents * item.quantity / 100
      return {
        id:           item.id,
        name,
        // product_id = parent product, variation_id = specific variant (size)
        product_id:   variant.products.id,
        variation_id: variant.id,
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
  // Accept any WC status request — we export both pending and confirmed orders.
  // pending   → WC "on-hold"    (placed, not yet admin-confirmed)
  // confirmed → WC "processing" (admin-confirmed, ready to roast/ship)
  const wcStatus = searchParams.get('status') ?? 'any'

  // Determine which of our statuses to include
  let statusFilter: string[]
  if (wcStatus === 'on-hold')     statusFilter = ['pending']
  else if (wcStatus === 'processing') statusFilter = ['confirmed']
  else                            statusFilter = ['pending', 'confirmed']

  const today = new Date().toISOString().split('T')[0]
  const supabase = createServerSupabaseClient()

  let query = supabase
    .from('orders')
    .select(`
      *,
      partners ( id, company_name, email, contact_person, phone, address, city, state, zip_code ),
      partner_locations ( id, name, contact_person, phone, address, city, state, zip_code ),
      order_items (
        *,
        product_variants (
          id, sku, size, product_id,
          products ( id, name )
        )
      )
    `)
    .in('status', statusFilter)
    .eq('source', 'portal')
    // Respect scheduled_for — future-dated and paused orders stay hidden
    .or(`scheduled_for.is.null,scheduled_for.lte.${today}`)
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
