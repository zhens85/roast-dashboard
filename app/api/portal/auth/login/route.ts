import { NextRequest, NextResponse } from 'next/server'
import { createPortalSupabaseClient } from '@/lib/supabase-portal'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email    = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  if (!email || !password) {
    const url = new URL('/portal/login', request.url)
    url.searchParams.set('error', 'missing')
    return NextResponse.redirect(url, { status: 303 })
  }

  const supabase = await createPortalSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const url = new URL('/portal/login', request.url)
    url.searchParams.set('error', 'invalid')
    return NextResponse.redirect(url, { status: 303 })
  }

  // @supabase/ssr automatically set the session cookies via the cookieStore.
  // Redirect to products page.
  return NextResponse.redirect(new URL('/portal/products', request.url), { status: 303 })
}
