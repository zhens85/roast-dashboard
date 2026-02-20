import { NextRequest, NextResponse } from 'next/server'
import { createPortalSupabaseClient } from '@/lib/supabase-portal'

export async function POST(request: NextRequest) {
  const supabase = await createPortalSupabaseClient()
  await supabase.auth.signOut()

  // @supabase/ssr clears the session cookies automatically.
  return NextResponse.redirect(new URL('/portal/login', request.url), { status: 303 })
}
