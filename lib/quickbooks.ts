/**
 * QuickBooks Online API integration.
 *
 * Setup checklist (one-time):
 * 1. Create an app at https://developer.intuit.com — select "Accounting" scope
 * 2. Add to Vercel env vars:
 *      QUICKBOOKS_CLIENT_ID      — from the Intuit app dashboard
 *      QUICKBOOKS_CLIENT_SECRET  — from the Intuit app dashboard
 *      QUICKBOOKS_REDIRECT_URI   — https://goodfolks.coffee/api/integrations/quickbooks/callback
 *      QUICKBOOKS_SANDBOX        — "true" during testing, remove or set "false" for production
 * 3. Run SQL migration 20 (SQL/20_settings_table.sql) in Supabase
 * 4. Visit /admin/settings and click "Connect to QuickBooks"
 */

import { createServerSupabaseClient } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────

const INTUIT_AUTH_URL  = 'https://appcenter.intuit.com/connect/oauth2'
const INTUIT_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

function qboBaseUrl(realmId: string): string {
  const sandbox = process.env.QUICKBOOKS_SANDBOX === 'true'
  const host = sandbox
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com'
  return `${host}/v3/company/${realmId}`
}

// ── Token types ───────────────────────────────────────────────────────────────

export interface QBOCredentials {
  access_token:  string
  refresh_token: string
  realm_id:      string
  expires_at:    number   // Unix ms
  company_name?: string
}

// ── Token storage (settings table) ───────────────────────────────────────────

export async function getQBOCredentials(): Promise<QBOCredentials | null> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'quickbooks')
    .maybeSingle()
  return data?.value ?? null
}

export async function saveQBOCredentials(creds: QBOCredentials): Promise<void> {
  const supabase = createServerSupabaseClient()
  await supabase.from('settings').upsert({
    key:        'quickbooks',
    value:      creds,
    updated_at: new Date().toISOString(),
  })
}

export async function deleteQBOCredentials(): Promise<void> {
  const supabase = createServerSupabaseClient()
  await supabase.from('settings').delete().eq('key', 'quickbooks')
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.QUICKBOOKS_CLIENT_ID!,
    redirect_uri:  process.env.QUICKBOOKS_REDIRECT_URI!,
    response_type: 'code',
    scope:         'com.intuit.quickbooks.accounting',
    state,
  })
  return `${INTUIT_AUTH_URL}?${params}`
}

export async function exchangeCodeForTokens(
  code: string,
  realmId: string,
): Promise<QBOCredentials> {
  const clientId     = process.env.QUICKBOOKS_CLIENT_ID!
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!
  const basic        = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(INTUIT_TOKEN_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basic}`,
      'Accept':        'application/json',
    },
    body: new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI!,
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`QBO token exchange failed: ${txt}`)
  }

  const data = await res.json()
  return {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    realm_id:      realmId,
    expires_at:    Date.now() + data.expires_in * 1000,
  }
}

async function refreshAccessToken(creds: QBOCredentials): Promise<QBOCredentials> {
  const clientId     = process.env.QUICKBOOKS_CLIENT_ID!
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET!
  const basic        = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(INTUIT_TOKEN_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basic}`,
      'Accept':        'application/json',
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: creds.refresh_token,
    }),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`QBO token refresh failed: ${txt}`)
  }

  const data = await res.json()
  return {
    ...creds,
    access_token:  data.access_token,
    refresh_token: data.refresh_token ?? creds.refresh_token,
    expires_at:    Date.now() + data.expires_in * 1000,
  }
}

// Returns a valid (possibly freshly-refreshed) token set, or null if not connected.
export async function getValidQBOCredentials(): Promise<QBOCredentials | null> {
  const creds = await getQBOCredentials()
  if (!creds) return null

  // Refresh if expiring within 5 minutes
  if (Date.now() > creds.expires_at - 5 * 60 * 1000) {
    try {
      const refreshed = await refreshAccessToken(creds)
      await saveQBOCredentials(refreshed)
      return refreshed
    } catch (err) {
      console.error('[QBO] Token refresh failed:', err)
      return null
    }
  }

  return creds
}

// ── QBO API helpers ───────────────────────────────────────────────────────────

async function qboGet<T>(creds: QBOCredentials, path: string): Promise<T> {
  const res = await fetch(`${qboBaseUrl(creds.realm_id)}${path}`, {
    headers: {
      Authorization: `Bearer ${creds.access_token}`,
      Accept:        'application/json',
    },
  })
  if (!res.ok) throw new Error(`QBO GET ${path} failed: ${res.status}`)
  return res.json()
}

async function qboPost<T>(creds: QBOCredentials, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${qboBaseUrl(creds.realm_id)}${path}`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${creds.access_token}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`QBO POST ${path} failed: ${res.status} — ${txt}`)
  }
  return res.json()
}

// ── Customer lookup / creation ────────────────────────────────────────────────

interface QBOCustomer {
  Id:          string
  DisplayName: string
}

async function findOrCreateCustomer(
  creds: QBOCredentials,
  companyName: string,
  email: string,
): Promise<string> {
  // Escape single quotes in company name for the query
  const safeName = companyName.replace(/'/g, "\\'")
  const query    = encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${safeName}' MAXRESULTS 1`)

  const data = await qboGet<{ QueryResponse: { Customer?: QBOCustomer[] } }>(
    creds,
    `/query?query=${query}&minorversion=70`,
  )

  const existing = data.QueryResponse?.Customer?.[0]
  if (existing) return existing.Id

  // Create new customer
  const created = await qboPost<{ Customer: QBOCustomer }>(creds, '/customer?minorversion=70', {
    DisplayName:      companyName,
    CompanyName:      companyName,
    PrimaryEmailAddr: { Address: email },
  })

  return created.Customer.Id
}

// ── Invoice creation ──────────────────────────────────────────────────────────

interface OrderForInvoice {
  id:                number
  total_amount_cents: number
  notes:             string | null
  created_at:        string
  partners: {
    company_name:   string
    email:          string
    contact_person: string
  } | null
  order_items: Array<{
    quantity:         number
    unit_price_cents: number
    product_variants: {
      size: string
      products: { name: string }
    }
  }>
}

export async function createQBOInvoiceForOrder(orderId: number): Promise<void> {
  const creds = await getValidQBOCredentials()
  if (!creds) {
    console.log(`[QBO] Not connected — skipping invoice for order ${orderId}`)
    return
  }

  const supabase = createServerSupabaseClient()
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, total_amount_cents, notes, created_at,
      partners ( company_name, email, contact_person ),
      order_items (
        quantity, unit_price_cents,
        product_variants ( size, products ( name ) )
      )
    `)
    .eq('id', orderId)
    .single()

  if (!order || !order.partners) {
    console.warn(`[QBO] Order ${orderId} has no partner — skipping invoice`)
    return
  }

  const partner = order.partners as unknown as OrderForInvoice['partners']

  try {
    const customerId = await findOrCreateCustomer(
      creds,
      partner!.company_name,
      partner!.email,
    )

    // Build line items — one per order item
    const lines = (order.order_items as unknown as OrderForInvoice['order_items']).map((item) => ({
      Amount:     item.unit_price_cents * item.quantity / 100,
      DetailType: 'SalesItemLineDetail',
      Description: `${item.quantity}× ${item.product_variants.products.name} ${item.product_variants.size}`,
      SalesItemLineDetail: {
        ItemRef:    { value: '1', name: 'Services' },
        Qty:        1,
        UnitPrice:  item.unit_price_cents * item.quantity / 100,
      },
    }))

    const txnDate = new Date(order.created_at).toISOString().split('T')[0]
    const dueDate = (() => {
      const d = new Date(order.created_at)
      d.setDate(d.getDate() + 30)
      return d.toISOString().split('T')[0]
    })()

    await qboPost(creds, '/invoice?minorversion=70', {
      CustomerRef: { value: customerId },
      DocNumber:   `GFC-${orderId}`,
      TxnDate:     txnDate,
      DueDate:     dueDate,
      Line:        lines,
      CustomerMemo: order.notes
        ? { value: order.notes }
        : undefined,
    })

    console.log(`[QBO] Invoice created for order ${orderId} (GFC-${orderId})`)
  } catch (err) {
    // Log but never block the confirm flow
    console.error(`[QBO] Invoice creation failed for order ${orderId}:`, err)
  }
}
