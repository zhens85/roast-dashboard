import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { DashboardOrder } from '@/types'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

// Build the Basic auth header from env vars
function shipStationAuth(): string {
  const key    = process.env.SHIPSTATION_API_KEY
  const secret = process.env.SHIPSTATION_API_SECRET
  if (!key || !secret) throw new Error('SHIPSTATION_API_KEY or SHIPSTATION_API_SECRET not set')
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64')
}

// Convert one DashboardOrder into a ShipStation createorder payload
function buildShipStationOrder(order: DashboardOrder): object {
  const p = order.partners

  // Build a clean ship-to address from the partner profile
  const shipTo = {
    name:       p.contact_person,
    company:    p.company_name,
    street1:    p.address    ?? '',
    city:       p.city       ?? '',
    state:      p.state      ?? '',
    postalCode: p.zip_code   ?? '',
    country:    'US',
    phone:      p.phone      ?? '',
  }

  const items = order.order_items.map((item) => ({
    lineItemKey: String(item.id),
    sku:         item.product_variants.sku,
    name:        `${item.product_variants.products.name} ${item.product_variants.size}`,
    quantity:    item.quantity,
    unitPrice:   item.unit_price_cents / 100,
    // Weight per bag by size — ShipStation expects ounces
    weight: {
      value: item.product_variants.size === '12oz' ? 14   // 12oz + bag
           : item.product_variants.size === '2lb'  ? 34   // 2lb + bag
           :                                         82,  // 5lb + bag
      units: 'ounces',
    },
  }))

  return {
    orderNumber:  String(order.id),
    orderKey:     `gfc-${order.id}`,
    orderDate:    order.created_at,
    orderStatus:  'awaiting_shipment',
    customerEmail: p.email,
    billTo:        shipTo,
    shipTo:        shipTo,
    items,
    amountPaid:    order.total_amount_cents / 100,
    customerNotes: order.notes ?? undefined,
    internalNotes: `Good Folks wholesale order #${order.id} — ${p.company_name}`,
    advancedOptions: {
      source: 'Good Folks Wholesale',
    },
  }
}

// POST /api/shipstation/push
// Body: { orderIds: number[] }
// Pushes each order to ShipStation as an awaiting_shipment order.
export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let orderIds: number[]
  try {
    const body = await request.json()
    if (!Array.isArray(body.orderIds) || body.orderIds.length === 0) {
      throw new Error('orderIds must be a non-empty array')
    }
    orderIds = body.orderIds
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  // Verify env vars up front — fail fast before hitting ShipStation
  let authHeader: string
  try {
    authHeader = shipStationAuth()
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  // Fetch the full order data including partner address and line items
  const supabase = createServerSupabaseClient()
  const { data: orders, error: dbError } = await supabase
    .from('orders')
    .select(`
      *,
      partners (*),
      order_items (
        *,
        product_variants (
          *,
          products (*)
        )
      )
    `)
    .in('id', orderIds)

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // Push each order to ShipStation sequentially (rate limit: 40 req/min)
  const results: { orderId: number; success: boolean; error?: string; shipStationOrderId?: number }[] = []

  for (const order of (orders as DashboardOrder[])) {
    try {
      const payload = buildShipStationOrder(order)

      const res = await fetch('https://ssapi.shipstation.com/orders/createorder', {
        method:  'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errBody = await res.text()
        throw new Error(`ShipStation ${res.status}: ${errBody}`)
      }

      const ssOrder = await res.json()
      results.push({ orderId: order.id, success: true, shipStationOrderId: ssOrder.orderId })

    } catch (e: unknown) {
      results.push({ orderId: order.id, success: false, error: (e as Error).message })
    }
  }

  const allOk = results.every((r) => r.success)
  return NextResponse.json({ results }, { status: allOk ? 200 : 207 })
}
