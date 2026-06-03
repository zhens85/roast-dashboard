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

// GET /wp-json/wc/v3/products
// Returns active product variants as WooCommerce simple products.
// Cropster uses this to link SKUs to roast profiles.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { code: 'woocommerce_rest_cannot_view', message: 'Unauthorized' },
      { status: 401 }
    )
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('product_variants')
    .select('id, sku, size, price_cents, is_available, products(id, name)')
    .eq('is_available', true)
    .order('sku')

  if (error) {
    return NextResponse.json(
      { code: 'woocommerce_rest_invalid_query', message: error.message },
      { status: 500 }
    )
  }

  const products = (data ?? []).map((v) => {
    const product = v.products as { id: number; name: string } | null
    return {
      id:          v.id,
      name:        product ? `${product.name} ${v.size}` : v.sku,
      slug:        v.sku.toLowerCase(),
      sku:         v.sku,
      type:        'simple',
      status:      'publish',
      price:       (v.price_cents / 100).toFixed(2),
      regular_price: (v.price_cents / 100).toFixed(2),
      sale_price:  '',
      on_sale:     false,
      purchasable: true,
      variations:  [],
      meta_data:   [],
    }
  })

  return NextResponse.json(products, {
    headers: {
      'X-WP-Total':      String(products.length),
      'X-WP-TotalPages': '1',
    },
  })
}
