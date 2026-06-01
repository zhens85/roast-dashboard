import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { DashboardOrder } from '@/types'

function isAuthorized(request: NextRequest): boolean {
  const key    = process.env.WC_CONSUMER_KEY
  const secret = process.env.WC_CONSUMER_SECRET
  if (!key || !secret) return false

  const { searchParams } = new URL(request.url)
  const qKey    = searchParams.get('consumer_key')
  const qSecret = searchParams.get('consumer_secret')
  if (qKey !== null && qSecret !== null) {
    return qKey === key && qSecret === secret
  }

  const auth = request.headers.get('authorization') ?? ''
  if (auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf-8')
    const colon   = decoded.indexOf(':')
    if (colon === -1) return false
    return decoded.slice(0, colon) === key && decoded.slice(colon + 1) === secret
  }

  return false
}

// Inline the mapper here (same as in the list route)
function toWCOrder(order: DashboardOrder) {
  const p = order.partners
  const [firstName, ...rest] = (p?.contact_person ?? '').split(' ')
  const lastName = rest.join(' ')

  return {
    id: order.id, number: String(order.id),
    order_key: `wc_order_${order.id}`,
    status: 'processing',
    currency: 'USD',
    date_created: order.created_at, date_modified: order.created_at,
    total: (order.total_amount_cents / 100).toFixed(2),
    customer_note: order.notes ?? '',
    billing: {
      first_name: firstName, last_name: lastName,
      company: p?.company_name ?? '', address_1: p?.address ?? '',
      city: p?.city ?? '', state: p?.state ?? '', postcode: p?.zip_code ?? '',
      country: 'US', email: p?.email ?? '', phone: p?.phone ?? '',
    },
    shipping: {
      first_name: firstName, last_name: lastName,
      company: p?.company_name ?? '', address_1: p?.address ?? '',
      city: p?.city ?? '', state: p?.state ?? '', postcode: p?.zip_code ?? '',
      country: 'US',
    },
    line_items: order.order_items.map((item) => {
      const v = item.product_variants
      const total = item.unit_price_cents * item.quantity / 100
      return {
        id: item.id,
        name: `${v.products.name} ${v.size}`,
        product_id: v.products.id, variation_id: 0,
        quantity: item.quantity, sku: v.sku,
        price: (item.unit_price_cents / 100).toFixed(2),
        subtotal: total.toFixed(2), total: total.toFixed(2),
        subtotal_tax: '0.00', total_tax: '0.00',
        taxes: [], meta_data: [],
      }
    }),
    tax_lines: [], shipping_lines: [], fee_lines: [], coupon_lines: [], meta_data: [],
  }
}

// GET /wp-json/wc/v3/orders/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ code: 'woocommerce_rest_cannot_view', message: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const orderId = parseInt(id, 10)
  if (isNaN(orderId)) {
    return NextResponse.json({ code: 'woocommerce_rest_invalid_id', message: 'Invalid order id' }, { status: 404 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
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
    .eq('id', orderId)
    .eq('status', 'confirmed')
    .eq('source', 'portal')
    .single()

  if (error || !data) {
    return NextResponse.json({ code: 'woocommerce_rest_order_invalid_id', message: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json(toWCOrder(data as DashboardOrder))
}
