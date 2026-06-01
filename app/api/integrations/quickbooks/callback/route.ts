import { NextRequest, NextResponse } from 'next/server'
import {
  exchangeCodeForTokens,
  saveQBOCredentials,
  getValidQBOCredentials,
} from '@/lib/quickbooks'

// GET /api/integrations/quickbooks/callback
// Intuit redirects here after the user approves the OAuth request.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code    = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const state   = searchParams.get('state')
  const error   = searchParams.get('error')

  const adminUrl = '/admin/settings'

  // User denied access
  if (error) {
    return NextResponse.redirect(new URL(`${adminUrl}?qbo=denied`, request.url))
  }

  if (!code || !realmId) {
    return NextResponse.redirect(new URL(`${adminUrl}?qbo=error`, request.url))
  }

  // Verify state cookie to prevent CSRF
  const storedState = request.cookies.get('qbo_oauth_state')?.value
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL(`${adminUrl}?qbo=state_mismatch`, request.url))
  }

  try {
    const creds = await exchangeCodeForTokens(code, realmId)

    // Try to fetch the company name to display in the settings UI
    try {
      const validCreds = { ...creds }
      const res = await fetch(
        `https://${process.env.QUICKBOOKS_SANDBOX === 'true' ? 'sandbox-' : ''}quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`,
        {
          headers: {
            Authorization: `Bearer ${creds.access_token}`,
            Accept:        'application/json',
          },
        }
      )
      if (res.ok) {
        const data = await res.json()
        validCreds.company_name = data.CompanyInfo?.CompanyName ?? undefined
        await saveQBOCredentials(validCreds)
      } else {
        await saveQBOCredentials(creds)
      }
    } catch {
      await saveQBOCredentials(creds)
    }

    const response = NextResponse.redirect(new URL(`${adminUrl}?qbo=connected`, request.url))
    response.cookies.delete('qbo_oauth_state')
    return response
  } catch (err) {
    console.error('[QBO] OAuth callback error:', err)
    return NextResponse.redirect(new URL(`${adminUrl}?qbo=error`, request.url))
  }
}
