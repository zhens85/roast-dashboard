import { NextRequest, NextResponse } from 'next/server'
import { createPortalSupabaseClient } from '@/lib/supabase-portal'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const email    = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  if (!email || !password) {
    const url = new URL('/', request.url)
    url.searchParams.set('error', 'missing')
    return NextResponse.redirect(url, { status: 303 })
  }

  const supabase = await createPortalSupabaseClient()
  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !authData.user) {
    const url = new URL('/', request.url)
    url.searchParams.set('error', 'invalid')
    return NextResponse.redirect(url, { status: 303 })
  }

  // Check approval status using the service role client (bypasses RLS)
  const adminSupabase = createServerSupabaseClient()
  const { data: partner } = await adminSupabase
    .from('partners')
    .select('is_approved')
    .eq('id', authData.user.id)
    .single()

  if (!partner?.is_approved) {
    // Sign them back out — they authenticated but aren't approved yet
    await supabase.auth.signOut()
    const url = new URL('/', request.url)
    url.searchParams.set('error', 'pending_approval')
    return NextResponse.redirect(url, { status: 303 })
  }

  // @supabase/ssr automatically set the session cookies via the cookieStore.
  return NextResponse.redirect(new URL('/products', request.url), { status: 303 })
}
