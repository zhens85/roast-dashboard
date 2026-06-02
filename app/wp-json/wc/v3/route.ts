import { NextResponse } from 'next/server'

// WooCommerce namespace root endpoint.
// Cropster (and other WC clients) hit this to validate the shop URL
// before attempting any authenticated requests.
export async function GET() {
  return NextResponse.json({
    namespace: 'wc/v3',
    routes: {
      '/wc/v3': {
        namespace: 'wc/v3',
        methods: ['GET'],
        endpoints: [{ methods: ['GET'], args: {} }],
      },
      '/wc/v3/orders': {
        namespace: 'wc/v3',
        methods: ['GET'],
        endpoints: [{ methods: ['GET'], args: {
          context:  { required: false, default: 'view' },
          page:     { required: false, default: 1 },
          per_page: { required: false, default: 10 },
          status:   { required: false },
          after:    { required: false },
          before:   { required: false },
        }}],
      },
      '/wc/v3/orders/(?P<id>[\\d]+)': {
        namespace: 'wc/v3',
        methods: ['GET'],
        endpoints: [{ methods: ['GET'], args: { id: { required: true } } }],
      },
    },
  })
}
