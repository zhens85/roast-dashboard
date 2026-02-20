import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// ── Staff dashboard auth ─────────────────────────────────────────────────────
const STAFF_COOKIE  = 'roast_session'
const SESSION_TOKEN = 'authenticated'

// Portal pages that don't require a Supabase session
const PORTAL_PUBLIC_PATHS = [
  '/',
  '/signup',
  '/reset-password',
  '/update-password',
]

// Portal pages that DO require auth (any path not in PORTAL_PUBLIC_PATHS and not /admin or /login)
function isPortalProtected(pathname: string): boolean {
  if (pathname.startsWith('/admin') || pathname.startsWith('/login') || pathname.startsWith('/api')) return false
  return !PORTAL_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '?'))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  let response = NextResponse.next({ request })

  // ── Staff dashboard guard ────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    const sessionCookie = request.cookies.get(STAFF_COOKIE)
    if (sessionCookie?.value !== SESSION_TOKEN) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return response
  }

  // ── Partner portal guard ─────────────────────────────────────────────────
  if (isPortalProtected(pathname)) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/products',
    '/products/:path*',
    '/cart',
    '/cart/:path*',
    '/orders',
    '/orders/:path*',
  ],
}
