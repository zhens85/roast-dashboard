import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase'

const resend = new Resend(process.env.RESEND_API_KEY)

const ORDER_NOTIFICATION_TO   = 'orders@goodfolkscoffee.com'
const APPROVAL_NOTIFICATION_TO = 'orders@goodfolkscoffee.com'
const FROM_ADDRESS             = 'Good Folks Wholesale <noreply@goodfolks.coffee>'

function fmtPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Sends an order notification email to orders@goodfolkscoffee.com.
 * Uses the service-role client to fetch full order + partner + line item data.
 * Fire-and-forget safe — callers should catch and log errors.
 */
export async function sendOrderNotificationEmail(orderId: number): Promise<void> {
  const supabase = createServerSupabaseClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id,
      created_at,
      total_amount_cents,
      notes,
      partners (
        company_name,
        contact_person,
        email,
        phone,
        address,
        city,
        state,
        zip_code
      ),
      order_items (
        quantity,
        unit_price_cents,
        product_variants (
          size,
          sku,
          products ( name )
        )
      )
    `)
    .eq('id', orderId)
    .single()

  if (error || !order) {
    throw new Error(`Failed to fetch order ${orderId} for email: ${error?.message}`)
  }

  const p       = order.partners as unknown as {
    company_name: string; contact_person: string; email: string; phone: string | null
    address: string | null; city: string | null; state: string | null; zip_code: string | null
  }
  const items   = order.order_items as unknown as {
    quantity: number; unit_price_cents: number
    product_variants: { size: string; sku: string; products: { name: string } }
  }[]

  const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago',
  })

  const itemRows = items.map((item) => {
    const name = `${item.product_variants.products.name} ${item.product_variants.size}`
    const sku  = item.product_variants.sku
    const line = item.quantity * item.unit_price_cents
    return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#3b4858;">${name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#777;font-size:12px;">${sku}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#3b4858;">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#3b4858;">${fmtPrice(item.unit_price_cents)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#3b4858;">${fmtPrice(line)}</td>
        </tr>`
  }).join('')

  const addressLine = [p.address, p.city, p.state, p.zip_code].filter(Boolean).join(', ')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f7f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#466c7e;padding:24px 32px;">
      <p style="margin:0;color:white;font-size:20px;font-weight:600;">New Wholesale Order</p>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Order #${order.id} · ${orderDate} CT</p>
    </div>

    <!-- Partner info -->
    <div style="padding:24px 32px;border-bottom:1px solid #f0f0f0;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#999;">Partner</p>
      <p style="margin:0;font-size:16px;font-weight:600;color:#3b4858;">${p.company_name}</p>
      <p style="margin:2px 0 0;color:#555;font-size:14px;">${p.contact_person}</p>
      <p style="margin:2px 0 0;color:#777;font-size:13px;">${p.email}${p.phone ? ' · ' + p.phone : ''}</p>
      ${addressLine ? `<p style="margin:6px 0 0;color:#777;font-size:13px;">${addressLine}</p>` : ''}
    </div>

    <!-- Line items -->
    <div style="padding:24px 32px;">
      <p style="margin:0 0 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#999;">Order Items</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#fafafa;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#999;">Product</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#999;">SKU</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#999;">Qty</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#999;">Unit</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#999;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr style="background:#fafafa;">
            <td colspan="4" style="padding:10px 12px;text-align:right;font-weight:600;color:#3b4858;">Order Total</td>
            <td style="padding:10px 12px;text-align:right;font-weight:700;font-size:15px;color:#466c7e;">${fmtPrice(order.total_amount_cents)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    ${order.notes ? `
    <!-- Notes -->
    <div style="padding:0 32px 24px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#999;">Partner Notes</p>
      <p style="margin:0;padding:12px;background:#f7f5f2;border-radius:8px;color:#466c7e;font-style:italic;font-size:14px;">${order.notes}</p>
    </div>` : ''}

    <!-- Footer -->
    <div style="padding:16px 32px;background:#fafafa;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">Good Folks Coffee · Wholesale Portal · <a href="https://goodfolks.coffee/admin" style="color:#466c7e;text-decoration:none;">View Dashboard →</a></p>
    </div>

  </div>
</body>
</html>`

  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set — email cannot be sent')
  }

  const { data, error: sendError } = await resend.emails.send({
    from:    FROM_ADDRESS,
    to:      ORDER_NOTIFICATION_TO,
    subject: `New Order #${order.id} — ${p.company_name} (${fmtPrice(order.total_amount_cents)})`,
    html,
  })

  if (sendError) {
    throw new Error(`Resend error: ${JSON.stringify(sendError)}`)
  }

  console.log(`Order notification email sent for order ${order.id}, Resend id: ${data?.id}`)
}

/**
 * Sends a new partner approval request email to the staff inbox.
 * Called on self-signup so staff can review and approve the account.
 */
export async function sendApprovalRequestEmail({
  companyName,
  contactPerson,
  email,
  partnerId,
}: {
  companyName:   string
  contactPerson: string
  email:         string
  partnerId:     string
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set — email cannot be sent')
  }

  const dashboardUrl = `https://goodfolks.coffee/admin/partners`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f7f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#3b4858;padding:24px 32px;">
      <p style="margin:0;color:white;font-size:20px;font-weight:600;">New Account Request</p>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.65);font-size:13px;">A partner has requested access to the wholesale portal</p>
    </div>

    <!-- Details -->
    <div style="padding:28px 32px;">
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;width:130px;color:#999;vertical-align:top;">Company</td>
          <td style="padding:6px 0;color:#3b4858;font-weight:600;">${companyName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#999;vertical-align:top;">Contact</td>
          <td style="padding:6px 0;color:#3b4858;">${contactPerson}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#999;vertical-align:top;">Email</td>
          <td style="padding:6px 0;color:#3b4858;">${email}</td>
        </tr>
      </table>

      <div style="margin-top:24px;">
        <a href="${dashboardUrl}"
           style="display:inline-block;background:#466c7e;color:white;text-decoration:none;
                  font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;">
          Review in Dashboard →
        </a>
      </div>
      <p style="margin:16px 0 0;font-size:12px;color:#aaa;">
        Find <strong>${companyName}</strong> in the Partners section and click Approve to grant access,
        or Delete to decline the request.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:14px 32px;background:#fafafa;border-top:1px solid #f0f0f0;">
      <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">Good Folks Coffee · Wholesale Portal</p>
    </div>

  </div>
</body>
</html>`

  const { data, error: sendError } = await resend.emails.send({
    from:    FROM_ADDRESS,
    to:      APPROVAL_NOTIFICATION_TO,
    subject: `New Account Request — ${companyName}`,
    html,
  })

  if (sendError) {
    throw new Error(`Resend error: ${JSON.stringify(sendError)}`)
  }

  console.log(`Approval request email sent for partner ${partnerId} (${email}), Resend id: ${data?.id}`)
}
