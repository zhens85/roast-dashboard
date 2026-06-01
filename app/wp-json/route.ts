import { NextResponse } from 'next/server'

// WooCommerce API discovery endpoint.
// Cropster (and other WooCommerce clients) hit this first to confirm
// the shop supports the wc/v3 namespace before fetching orders.
export async function GET() {
  return NextResponse.json({
    name:        'Good Folks Wholesale Portal',
    description: 'Wholesale coffee ordering portal',
    url:         'https://goodfolks.coffee',
    namespaces:  ['wc/v3'],
    authentication: {},
    routes: {
      '/wc/v3': { namespace: 'wc/v3', methods: ['GET'] },
      '/wc/v3/orders': { namespace: 'wc/v3', methods: ['GET'] },
    },
  })
}
