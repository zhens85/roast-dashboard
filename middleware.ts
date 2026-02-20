import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// ── Staff dashboard auth ─────────────────────────────────────────────────────
const STAFF_COOKIE  = 'roast_session'
const SESSION_TOKEN = 'authenticated'

// Routes accessible without portal login
const PORTAL_PUBLIC_PATHS = ['/portal/login', '/portal/signup']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  let response = NextResponse.next({ request })

  // ── Staff dashboard guard ────────────────────────────────────────────────
  // Protected by a shared password cookie (simple internal tool auth)
  if (pathname.startsWith('/dashboard')) {
    const sessionCookie = request.cookies.get(STAFF_COOKIE)
    if (sessionCookie?.value !== SESSION_TOKEN) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return response
  }

  // ── Partner portal guard ─────────────────────────────────────────────────
  // Protected by Supabase Auth session cookies (email + password login)
  if (pathname.startsWith('/portal')) {
    // Allow public portal pages (login, signup) through
    if (PORTAL_PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
      return response
    }

    // Create a Supabase client that can read + refresh the session cookie
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // Write cookies to both the request (for this middleware) and
            // the response (so the browser receives the refreshed token)
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    // getUser() validates the JWT and refreshes the session if needed.
    // Never use getSession() in middleware — it doesn't revalidate the JWT.
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/portal/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/portal/:path*'],
}
