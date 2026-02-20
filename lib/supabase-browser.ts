'use client'

import { createBrowserClient } from '@supabase/ssr'

// Creates a Supabase client for use in Client Components ('use client').
//
// Uses the anon key — safe to expose to the browser.
// Session is managed automatically via cookies set by @supabase/ssr.
//
// Use this in Client Components that need to call Supabase directly
// (e.g. sign-in/sign-up forms that need to handle auth state client-side).
// For data fetching, prefer Server Components with createPortalSupabaseClient().

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
