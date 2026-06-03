/**
 * ShipStation Custom Store XML Endpoint
 *
 * ShipStation polls this endpoint to import orders and posts back tracking info.
 *
 * GET  ?action=export&start_date=MM/DD/YYYY+HH:MM&end_date=MM/DD/YYYY+HH:MM&page=1
 *   → Returns XML list of orders modified in the date range
 *
 * POST ?action=shipnotify&order_number=...&carrier=...&tracking_number=...
 *   → ShipStation notifies us that an order has shipped; we update the DB
 *
 * Auth: HTTP Basic — credentials set in ShipStation Custom Store config.
 *   Set SHIPSTATION_STORE_USERNAME and SHIPSTATION_STORE_PASSWORD in env vars.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { DashboardOrder } from '@/types'

function nextOccurrenceDate(dateISO: string, interval: string | null): string {
  const d = new Date(dateISO + 'T12:00:00Z')
  switch (interval) {
    case 'weekly':        d.setUTCDate(d.getUTCDate() + 7);   break
    case 'monthly':       d.setUTCMonth(d.getUTCMonth() + 1); break
    case 'every_6_weeks': d.setUTCDate(d.getUTCDate() + 42);  break
    case 'every_8_weeks': d.setUTCDate(d.getUTCDate() + 56);  break
    default:              d.setUTCDate(d.getUTCDate() + 14);  break
  }
  return d.toISOString().split('T')[0]
}

// ── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const expectedUser = process.env.SHIPSTATION_STORE_USERNAME
  const expectedPass = process.env.SHIPSTATION_STORE_PASSWORD

  if (!expectedUser || !expectedPass) {
    console.error('[ShipStation] SHIPSTATION_STORE_USERNAME or SHIPSTATION_STORE_PASSWORD not set')
    return false
  }

  // ShipStation sends credentials as query params (SS-UserName / SS-Password),
  // not as an Authorization header, despite their docs suggesting Basic auth.
  const { searchParams } = new URL(request.url)
  const qUser = searchParams.get('SS-UserName') ?? searchParams.get('ss-username') ?? searchParams.get('username')
  const qPass = searchParams.get('SS-Password') ?? searchParams.get('ss-password') ?? searchParams.get('password')

  if (qUser !== null && qPass !== null) {
    return qUser === expectedUser && qPass === expectedPass
  }

  // Fallback: standard HTTP Basic auth header
  const authHeader = request.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Basic ')) return false

  const encoded = authHeader.slice('Basic '.length).trim()
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
  const colonIndex = decoded.indexOf(':')
  if (colonIndex === -1) return false

  const user = decoded.slice(0, colonIndex)
  const pass = decoded.slice(colonIndex + 1)
  return user === expectedUser && pass === expectedPass
}

function unauthorized(): NextResponse {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="ShipStation"' },
  })
}

// ── Date parsing ──────────────────────────────────────────────────────────────
// ShipStation sends dates like "01/15/2024 00:00" (MM/DD/YYYY HH:MM)

function parseShipStationDate(raw: string | null): Date | null {
  if (!raw) return null
  // Replace "+" that URL encoding turns spaces into
  const clean = raw.replace(/\+/g, ' ').trim()
  // "MM/DD/YYYY HH:MM"
  const match = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, mm, dd, yyyy, hh, min] = match
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00Z`)
}

// ── XML builder helpers ───────────────────────────────────────────────────────

function cdata(value: string | null | undefined): string {
  return `<![CDATA[${value ?? ''}]]>`
}

function fmt(date: string): string {
  // ShipStation expects "MM/DD/YYYY HH:MM" in the export XML
  const d = new Date(date)
  const mm  = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd  = String(d.getUTCDate()).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  const hh  = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${mm}/${dd}/${yyyy} ${hh}:${min}`
}

function weightOz(size: string): number {
  if (size === '12oz') return 14  // product + bag
  if (size === '2lb')  return 34
  return 82                        // 5lb
}

function buildOrderXml(order: DashboardOrder): string {
  const p    = order.partners
  const ship = order.shipping_address

  // Resolve display fields — prefer partner account data, fall back to
  // Shopify customer / shipping address fields for unmatched orders.
  // Location overrides partner address when present
  const loc = order.partner_locations ?? null

  const customerCode  = p?.email        ?? order.customer_email ?? ''
  const contactName   = loc?.contact_person ?? p?.contact_person ?? order.customer_name ?? ship?.name ?? ''
  const companyName   = p?.company_name   ?? ship?.company ?? order.customer_name ?? `Shopify #${order.id}`
  const phone         = loc?.phone    ?? p?.phone  ?? ship?.phone ?? ''
  const email         = p?.email          ?? order.customer_email ?? ''
  const address1      = loc?.address  ?? p?.address  ?? ship?.address1 ?? ''
  const city          = loc?.city     ?? p?.city     ?? ship?.city ?? ''
  const state         = loc?.state    ?? p?.state    ?? ship?.province_code ?? ''
  const zip           = loc?.zip_code ?? p?.zip_code ?? ship?.zip ?? ''
  const internalNote  = p
    ? `Good Folks wholesale order #${order.id} — ${p.company_name}`
    : `Shopify order #${order.id} — ${companyName}`

  const itemsXml = order.order_items.map((item) => {
    const variant = item.product_variants
    const name    = `${variant.products.name} ${variant.size}`
    return `
    <Item>
      <SKU>${cdata(variant.sku)}</SKU>
      <Name>${cdata(name)}</Name>
      <ImageUrl></ImageUrl>
      <Weight>${weightOz(variant.size)}.00</Weight>
      <WeightUnits>Ounces</WeightUnits>
      <Quantity>${item.quantity}</Quantity>
      <UnitPrice>${(item.unit_price_cents / 100).toFixed(2)}</UnitPrice>
      <Location></Location>
      <Options/>
    </Item>`
  }).join('')

  const total = (order.total_amount_cents / 100).toFixed(2)

  return `
  <Order>
    <OrderID>${order.id}</OrderID>
    <OrderNumber>${order.id}</OrderNumber>
    <OrderDate>${fmt(order.created_at)}</OrderDate>
    <OrderStatus>awaiting_shipment</OrderStatus>
    <LastModified>${fmt(order.created_at)}</LastModified>
    <ShippingMethod></ShippingMethod>
    <PaymentMethod>${p ? 'Invoice' : 'Shopify'}</PaymentMethod>
    <OrderTotal>${total}</OrderTotal>
    <TaxAmount>0.00</TaxAmount>
    <ShippingAmount>0.00</ShippingAmount>
    <CustomerNotes>${cdata(order.notes)}</CustomerNotes>
    <InternalNotes>${cdata(internalNote)}</InternalNotes>
    <Gift>false</Gift>
    <GiftMessage></GiftMessage>
    <CustomField1></CustomField1>
    <CustomField2></CustomField2>
    <CustomField3></CustomField3>
    <Customer>
      <CustomerCode>${cdata(customerCode)}</CustomerCode>
      <BillTo>
        <Name>${cdata(contactName)}</Name>
        <Company>${cdata(companyName)}</Company>
        <Phone>${cdata(phone)}</Phone>
        <Email>${cdata(email)}</Email>
      </BillTo>
      <ShipTo>
        <Name>${cdata(contactName)}</Name>
        <Company>${cdata(companyName)}</Company>
        <Address1>${cdata(address1)}</Address1>
        <Address2></Address2>
        <City>${cdata(city)}</City>
        <State>${cdata(state)}</State>
        <PostalCode>${cdata(zip)}</PostalCode>
        <Country>US</Country>
        <Phone>${cdata(phone)}</Phone>
      </ShipTo>
    </Customer>
    <Items>${itemsXml}
    </Items>
  </Order>`
}

// ── GET — action=export ───────────────────────────────────────────────────────

async function handleExport(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)

  const startDate = parseShipStationDate(searchParams.get('start_date'))
  const endDate   = parseShipStationDate(searchParams.get('end_date'))
  // const page   = parseInt(searchParams.get('page') ?? '1', 10)

  const supabase = createServerSupabaseClient()

  const today = new Date().toISOString().split('T')[0]  // YYYY-MM-DD

  let query = supabase
    .from('orders')
    .select(`
      *,
      partners (*),
      partner_locations ( id, name, contact_person, phone, address, city, state, zip_code ),
      order_items (
        *,
        product_variants (
          *,
          products (*)
        )
      )
    `)
    .not('status', 'eq', 'cancelled')
    // Don't export orders whose scheduled_for date hasn't arrived yet
    .or(`scheduled_for.is.null,scheduled_for.lte.${today}`)
    .order('created_at', { ascending: false })

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString())
  }

  const { data: orders, error } = await query

  if (error) {
    console.error('ShipStation export DB error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }

  const ordersXml = ((orders ?? []) as DashboardOrder[])
    .map(buildOrderXml)
    .join('')

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<Orders>${ordersXml}
</Orders>`

  return new NextResponse(xml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  })
}

// ── POST — action=shipnotify ──────────────────────────────────────────────────

async function handleShipNotify(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const orderNumber    = searchParams.get('order_number')
  const carrier        = searchParams.get('carrier')
  const trackingNumber = searchParams.get('tracking_number')
  const service        = searchParams.get('service')
  const shipDate       = searchParams.get('ship_date')

  if (!orderNumber) {
    return new NextResponse('Missing order_number', { status: 400 })
  }

  const orderId = parseInt(orderNumber, 10)
  if (isNaN(orderId)) {
    return new NextResponse('Invalid order_number', { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // Fetch the order before updating (need recurring fields for next-occurrence logic)
  const { data: orderData } = await supabase
    .from('orders')
    .select('id, partner_id, total_amount_cents, notes, is_recurring, recurring_interval, scheduled_for, location_id, order_items(product_variant_id, quantity, unit_price_cents)')
    .eq('id', orderId)
    .single()

  // Mark the order as shipped and store tracking info
  const { error } = await supabase
    .from('orders')
    .update({
      status:           'shipped',
      tracking_number:  trackingNumber ?? null,
      carrier:          carrier        ?? null,
      shipping_service: service        ?? null,
      shipped_at:       shipDate       ?? new Date().toISOString(),
    })
    .eq('id', orderId)

  if (error) {
    console.error(`ShipStation shipnotify DB error for order ${orderId}:`, error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }

  // For recurring orders, create the next occurrence now that this one has shipped
  if (orderData?.is_recurring && orderData.partner_id && orderData.scheduled_for) {
    const nextDate = nextOccurrenceDate(orderData.scheduled_for, orderData.recurring_interval)

    const { data: newOrder, error: insertErr } = await supabase
      .from('orders')
      .insert({
        partner_id:         orderData.partner_id,
        status:             'confirmed',
        total_amount_cents: orderData.total_amount_cents,
        notes:              orderData.notes ?? null,
        is_recurring:       true,
        recurring_interval: orderData.recurring_interval,
        scheduled_for:      nextDate,
        location_id:        orderData.location_id ?? null,
      })
      .select('id')
      .single()

    if (!insertErr && newOrder) {
      const items = (orderData.order_items ?? []).map(
        (item: { product_variant_id: number; quantity: number; unit_price_cents: number }) => ({
          order_id:           newOrder.id,
          product_variant_id: item.product_variant_id,
          quantity:           item.quantity,
          unit_price_cents:   item.unit_price_cents,
        })
      )
      if (items.length > 0) {
        await supabase.from('order_items').insert(items)
      }
      console.log(`Recurring order ${orderId} shipped → next occurrence created as order ${newOrder.id} (scheduled_for: ${nextDate})`)
    } else if (insertErr) {
      console.error(`Failed to create next occurrence for recurring order ${orderId}:`, insertErr.message)
    }
  }

  console.log(`Order ${orderId} marked shipped — carrier: ${carrier}, tracking: ${trackingNumber}`)
  return new NextResponse('OK', { status: 200 })
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()

  const action = new URL(request.url).searchParams.get('action')
  if (action === 'export') return handleExport(request)

  return new NextResponse('Unknown action', { status: 400 })
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()

  const action = new URL(request.url).searchParams.get('action')
  if (action === 'shipnotify') return handleShipNotify(request)

  return new NextResponse('Unknown action', { status: 400 })
}
