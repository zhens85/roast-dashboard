import { NextRequest, NextResponse } from 'next/server'
import { buildAuthUrl } from '@/lib/quickbooks'

// GET /api/integrations/quickbooks/connect
// Redirects the admin to Intuit's OAuth authorization page.
export async function GET(request: NextRequest) {
  if (request.cookies.get('roast_session')?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.QUICKBOOKS_CLIENT_ID || !process.env.QUICKBOOKS_REDIRECT_URI) {
    return NextResponse.json(
      { error: 'QUICKBOOKS_CLIENT_ID and QUICKBOOKS_REDIRECT_URI must be set in env vars' },
      { status: 500 }
    )
  }

  // Simple state token — timestamp-based, verified in callback
  const state = Buffer.from(`qbo-${Date.now()}`).toString('base64url')

  const url = buildAuthUrl(state)

  const response = NextResponse.redirect(url)
  // Store state in a short-lived cookie for CSRF verification
  response.cookies.set('qbo_oauth_state', state, {
    httpOnly: true,
    maxAge:   600,  // 10 minutes
    sameSite: 'lax',
    path:     '/',
  })
  return response
}
