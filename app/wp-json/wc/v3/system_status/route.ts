import { NextRequest, NextResponse } from 'next/server'

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

// GET /wp-json/wc/v3/system_status
// Cropster may call this to verify the WooCommerce connection.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { code: 'woocommerce_rest_cannot_view', message: 'Unauthorized' },
      { status: 401 }
    )
  }

  return NextResponse.json({
    environment: {
      site_url:       'https://www.goodfolks.coffee',
      wp_version:     '6.4.3',
      wc_version:     '8.5.2',
      log_directory_writable: true,
      wp_multisite:   false,
      wp_debug_mode:  false,
    },
    database: {
      wc_database_version: '8.5.2',
    },
    active_plugins:  [],
    theme:           { name: 'Good Folks Wholesale', version: '1.0.0' },
    settings:        { currency: 'USD', currency_symbol: '$' },
  })
}
