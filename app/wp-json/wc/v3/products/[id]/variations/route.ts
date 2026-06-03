import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthorized(request: NextRequest): boolean {
  const key    = process.env.WC_CONSUMER_KEY
  const secret = process.env.WC_CONSUMER_SECRET
  if (!key || !secret) return false
  const { searchParams } = new URL(request.url)
  const qKey    = searchParams.get('consumer_key')
  const qSecret = searchParams.get('consumer_secret')
  if (qKey !== null && qSecret !== null) return qKey === key && qSecret === secret
  const auth = request.headers.get('authorization') ?? ''
  if (auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf-8')
    const colon   = decoded.indexOf(':')
    if (colon === -1) return false
    return decoded.slice(0, colon) === key && decoded.slice(colon + 1) === secret
  }
  return false
}

// GET /wp-json/wc/v3/products/[id]/variations
// Returns the size variants of a product as WooCommerce variations.
// Cropster uses the SKUs here to link orders to roast profiles.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ code: 'woocommerce_rest_cannot_view', message: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const productId = parseInt(id, 10)
  if (isNaN(productId)) {
    return NextResponse.json([], { headers: { 'X-WP-Total': '0', 'X-WP-TotalPages': '1' } })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('product_variants')
    .select('id, sku, size, price_cents, is_available')
    .eq('product_id', productId)
    .eq('is_available', true)
    .order('size')

  if (error) {
    return NextResponse.json(
      { code: 'woocommerce_rest_invalid_query', message: error.message },
      { status: 500 }
    )
  }

  const variations = (data ?? []).map((v) => ({
    id:          v.id,
    sku:         v.sku,
    status:      'publish',
    purchasable: true,
    price:        (v.price_cents / 100).toFixed(2),
    regular_price:(v.price_cents / 100).toFixed(2),
    sale_price:  '',
    on_sale:     false,
    attributes: [
      { id: 1, name: 'Size', option: v.size },
    ],
    meta_data: [],
  }))

  return NextResponse.json(variations, {
    headers: {
      'X-WP-Total':      String(variations.length),
      'X-WP-TotalPages': '1',
    },
  })
}
