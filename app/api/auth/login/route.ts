import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME   = 'roast_session'
const SESSION_TOKEN = 'authenticated'
const MAX_AGE_SECS  = 60 * 60 * 8  // 8 hours

export async function POST(request: NextRequest) {
  const formData   = await request.formData()
  const password   = formData.get('password') as string
  const redirectTo = (formData.get('redirect') as string) || '/admin'

  const correctPassword = process.env.DASHBOARD_PASSWORD

  if (!correctPassword) {
    return new NextResponse('Server misconfiguration: DASHBOARD_PASSWORD not set.', {
      status: 500,
    })
  }

  if (password !== correctPassword) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'invalid')
    loginUrl.searchParams.set('redirect', redirectTo)
    return NextResponse.redirect(loginUrl, { status: 303 })
  }

  const response = NextResponse.redirect(new URL(redirectTo, request.url), {
    status: 303,
  })

  response.cookies.set(COOKIE_NAME, SESSION_TOKEN, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   MAX_AGE_SECS,
    path:     '/',
  })

  return response
}
