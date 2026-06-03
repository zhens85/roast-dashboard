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
// Returns active products as WooCommerce "variable" products.
// Each variant (12oz, 2lb, 5lb) is a variation under the parent product.
// Cropster uses this to link products to roast profiles via SKU.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { code: 'woocommerce_rest_cannot_view', message: 'Unauthorized' },
      { status: 401 }
    )
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, product_variants(id, sku, size, price_cents, is_available)')
    .eq('is_active', true)
    .order('name')

  if (error) {
    return NextResponse.json(
      { code: 'woocommerce_rest_invalid_query', message: error.message },
      { status: 500 }
    )
  }

  type Variant = { id: number; sku: string; size: string; price_cents: number; is_available: boolean }
  const products = (data ?? []).map((p) => {
    const variants = (p.product_variants as Variant[]).filter(v => v.is_available)
    return {
      id:          p.id,
      name:        p.name,
      slug:        p.name.toLowerCase().replace(/\s+/g, '-'),
      type:        'variable',
      status:      'publish',
      sku:         '',
      price:       '',
      regular_price: '',
      purchasable: true,
      variations:  variants.map(v => v.id),
      attributes: [
        {
          id:        1,
          name:      'Size',
          variation: true,
          visible:   true,
          options:   variants.map(v => v.size),
        },
      ],
      meta_data: [],
    }
  })

  return NextResponse.json(products, {
    headers: {
      'X-WP-Total':      String(products.length),
      'X-WP-TotalPages': '1',
    },
  })
}
