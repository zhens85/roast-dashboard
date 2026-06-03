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
    const colon = decoded.indexOf(':')
    if (colon === -1) return false
    return decoded.slice(0, colon) === key && decoded.slice(colon + 1) === secret
  }
  return false
}

// GET /wp-json/wc/v3/products/[id]
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
    return NextResponse.json({ code: 'woocommerce_rest_invalid_id', message: 'Invalid product id' }, { status: 404 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, product_variants(id, sku, size, price_cents, is_available)')
    .eq('id', productId)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return NextResponse.json({ code: 'woocommerce_rest_product_invalid_id', message: 'Product not found' }, { status: 404 })
  }

  type Variant = { id: number; sku: string; size: string; price_cents: number; is_available: boolean }
  const variants = (data.product_variants as Variant[]).filter(v => v.is_available)

  return NextResponse.json({
    id:          data.id,
    name:        data.name,
    slug:        data.name.toLowerCase().replace(/\s+/g, '-'),
    type:        'variable',
    status:      'publish',
    sku:         '',
    price:       '',
    purchasable: true,
    variations:  variants.map(v => v.id),
    attributes: [{
      id: 1, name: 'Size', variation: true, visible: true,
      options: variants.map(v => v.size),
    }],
    meta_data: [],
  })
}
