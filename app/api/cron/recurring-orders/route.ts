/**
 * Recurring orders cron job — runs at 2am EST (7am UTC) every day.
 *
 * For each recurring order whose scheduled_for date has arrived today:
 *  1. Creates the next occurrence so the schedule stays populated
 *     regardless of whether the current order has shipped yet.
 *  2. Sends a digest email to staff listing all orders due today.
 *
 * Vercel invokes this with the CRON_SECRET header for security.
 * The route is registered in vercel.json.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const NOTIFY_TO   = 'orders@goodfolkscoffee.com'
const FROM_ADDRESS = 'Good Folks Wholesale <noreply@goodfolks.coffee>'

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

function fmtPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export async function GET(request: NextRequest) {
  // Verify Vercel cron secret
  const cronSecret = request.headers.get('authorization')
  if (process.env.CRON_SECRET && cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase  = createServerSupabaseClient()
  const today     = new Date().toISOString().split('T')[0]  // YYYY-MM-DD in UTC

  // Find all confirmed recurring orders that are due today or overdue
  const { data: dueOrders, error } = await supabase
    .from('orders')
    .select(`
      id, partner_id, total_amount_cents, notes,
      is_recurring, recurring_interval, scheduled_for, location_id,
      partners ( company_name, email ),
      order_items ( product_variant_id, quantity, unit_price_cents,
                    product_variants ( size, products ( name ) ) )
    `)
    .eq('is_recurring', true)
    .eq('status', 'confirmed')
    .lte('scheduled_for', today)

  if (error) {
    console.error('[Cron] DB error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const orders = dueOrders ?? []
  const created: number[] = []

  for (const order of orders) {
    if (!order.scheduled_for) continue

    const nextDate = nextOccurrenceDate(order.scheduled_for, order.recurring_interval)

    // Check if a next occurrence already exists for this partner on that date
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('partner_id', order.partner_id)
      .eq('is_recurring', true)
      .eq('scheduled_for', nextDate)
      .in('status', ['confirmed', 'pending'])
      .limit(1)

    if (existing && existing.length > 0) {
      console.log(`[Cron] Next occurrence for order ${order.id} already exists — skipping`)
      continue
    }

    // Create the next occurrence
    const { data: newOrder, error: insertErr } = await supabase
      .from('orders')
      .insert({
        partner_id:         order.partner_id,
        status:             'confirmed',
        total_amount_cents: order.total_amount_cents,
        notes:              order.notes ?? null,
        is_recurring:       true,
        recurring_interval: order.recurring_interval,
        scheduled_for:      nextDate,
        location_id:        order.location_id ?? null,
      })
      .select('id')
      .single()

    if (insertErr || !newOrder) {
      console.error(`[Cron] Failed to create next occurrence for order ${order.id}:`, insertErr?.message)
      continue
    }

    // Copy line items
    const items = (order.order_items ?? []).map((item: {
      product_variant_id: number; quantity: number; unit_price_cents: number
    }) => ({
      order_id:           newOrder.id,
      product_variant_id: item.product_variant_id,
      quantity:           item.quantity,
      unit_price_cents:   item.unit_price_cents,
    }))

    if (items.length > 0) {
      await supabase.from('order_items').insert(items)
    }

    created.push(newOrder.id)
    console.log(`[Cron] Order ${order.id} → next occurrence created as #${newOrder.id} (${nextDate})`)
  }

  // Send digest email if there are orders due today
  const todayOrders = orders.filter(o => o.scheduled_for === today)
  if (todayOrders.length > 0 && process.env.RESEND_API_KEY) {
    try {
      const rows = todayOrders.map(o => {
        const p     = o.partners as unknown as { company_name: string; email: string } | null
        const items = (o.order_items ?? []) as unknown as Array<{
          quantity: number; unit_price_cents: number
          product_variants: { size: string; products: { name: string } }
        }>
        const linesSummary = items.map(i =>
          `${i.quantity}× ${i.product_variants?.products?.name} ${i.product_variants?.size}`
        ).join(', ')
        return `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">#${o.id}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${p?.company_name ?? '—'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${linesSummary}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmtPrice(o.total_amount_cents)}</td>
          </tr>`
      }).join('')

      await resend.emails.send({
        from:    FROM_ADDRESS,
        to:      NOTIFY_TO,
        subject: `📦 ${todayOrders.length} Recurring Order${todayOrders.length > 1 ? 's' : ''} Due Today — ${today}`,
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <h2 style="color:#3b4858;margin:0 0 16px;">Recurring Orders Due Today</h2>
            <p style="color:#777;margin:0 0 16px;">${todayOrders.length} recurring order${todayOrders.length > 1 ? 's are' : ' is'} scheduled for ${today}.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead style="background:#fafafa;">
                <tr>
                  <th style="padding:8px 12px;text-align:left;color:#999;font-size:11px;text-transform:uppercase;">Order</th>
                  <th style="padding:8px 12px;text-align:left;color:#999;font-size:11px;text-transform:uppercase;">Partner</th>
                  <th style="padding:8px 12px;text-align:left;color:#999;font-size:11px;text-transform:uppercase;">Items</th>
                  <th style="padding:8px 12px;text-align:right;color:#999;font-size:11px;text-transform:uppercase;">Total</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <div style="margin-top:20px;">
              <a href="https://www.goodfolks.coffee/admin/orders"
                 style="background:#466c7e;color:white;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;display:inline-block;">
                View in Dashboard →
              </a>
            </div>
          </div>`,
      })
      console.log(`[Cron] Digest email sent for ${todayOrders.length} due orders`)
    } catch (emailErr) {
      console.error('[Cron] Digest email failed:', emailErr)
    }
  }

  // Send a confirmation email to each account owner whose recurring order processed today
  if (process.env.RESEND_API_KEY) {
    for (const o of todayOrders) {
      const p = o.partners as unknown as { company_name: string; email: string } | null
      if (!p?.email) continue

      const items = (o.order_items ?? []) as unknown as Array<{
        quantity: number; unit_price_cents: number
        product_variants: { size: string; products: { name: string } }
      }>
      const itemRows = items.map(i => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${i.product_variants?.products?.name} ${i.product_variants?.size}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${i.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmtPrice(i.quantity * i.unit_price_cents)}</td>
        </tr>`).join('')

      try {
        await resend.emails.send({
          from:    FROM_ADDRESS,
          to:      p.email,
          subject: `Your Good Folks Wholesale Order #${o.id} Has Been Placed`,
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
              <h2 style="color:#3b4858;margin:0 0 16px;">Order Confirmed</h2>
              <p style="color:#777;margin:0 0 16px;">Hi ${p.company_name}, your recurring order #${o.id} has been placed and is being prepared for shipment.</p>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <thead style="background:#fafafa;">
                  <tr>
                    <th style="padding:8px 12px;text-align:left;color:#999;font-size:11px;text-transform:uppercase;">Item</th>
                    <th style="padding:8px 12px;text-align:center;color:#999;font-size:11px;text-transform:uppercase;">Qty</th>
                    <th style="padding:8px 12px;text-align:right;color:#999;font-size:11px;text-transform:uppercase;">Total</th>
                  </tr>
                </thead>
                <tbody>${itemRows}</tbody>
                <tfoot>
                  <tr>
                    <td colspan="2" style="padding:10px 12px;font-weight:600;">Order Total</td>
                    <td style="padding:10px 12px;font-weight:600;text-align:right;">${fmtPrice(o.total_amount_cents)}</td>
                  </tr>
                </tfoot>
              </table>
              <p style="color:#777;margin:20px 0 0;font-size:13px;">You'll receive a separate email with tracking info once your order ships.</p>
            </div>`,
        })
        console.log(`[Cron] Confirmation email sent to ${p.email} for order ${o.id}`)
      } catch (emailErr) {
        console.error(`[Cron] Confirmation email failed for order ${o.id}:`, emailErr)
      }
    }
  }

  return NextResponse.json({
    checked:  orders.length,
    due_today: todayOrders.length,
    next_occurrences_created: created,
  })
}
