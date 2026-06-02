import { NextRequest, NextResponse } from 'next/server'

// Temporary diagnostic endpoint — reveals auth method and whether env vars are loaded.
// Does NOT expose actual credential values.
// DELETE this file once the Cropster connection is working.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const authHeader = request.headers.get('authorization') ?? ''

  const hasEnvKey    = !!process.env.WC_CONSUMER_KEY
  const hasEnvSecret = !!process.env.WC_CONSUMER_SECRET

  // Detect auth method
  let authMethod = 'none'
  let keyMatch   = false
  let secretMatch = false

  if (authHeader.startsWith('Basic ')) {
    authMethod = 'basic'
    try {
      const decoded  = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8')
      const colon    = decoded.indexOf(':')
      const sentKey  = colon >= 0 ? decoded.slice(0, colon) : decoded
      const sentSec  = colon >= 0 ? decoded.slice(colon + 1) : ''
      keyMatch    = sentKey  === process.env.WC_CONSUMER_KEY
      secretMatch = sentSec  === process.env.WC_CONSUMER_SECRET
    } catch { /* ignore */ }
  } else if (authHeader.startsWith('OAuth ')) {
    authMethod = 'oauth1'
  } else if (searchParams.get('consumer_key')) {
    authMethod = 'query_params'
    keyMatch    = searchParams.get('consumer_key')    === process.env.WC_CONSUMER_KEY
    secretMatch = searchParams.get('consumer_secret') === process.env.WC_CONSUMER_SECRET
  }

  return NextResponse.json({
    env_vars_loaded: { key: hasEnvKey, secret: hasEnvSecret },
    auth_method_detected: authMethod,
    credentials_match: authMethod !== 'oauth1' ? { key: keyMatch, secret: secretMatch } : 'oauth1_not_checked',
    auth_header_prefix: authHeader ? authHeader.slice(0, 12) + '...' : null,
    has_query_params: {
      consumer_key:    searchParams.has('consumer_key'),
      consumer_secret: searchParams.has('consumer_secret'),
    },
  })
}
