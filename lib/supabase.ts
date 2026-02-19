import { createClient } from '@supabase/supabase-js'

// Creates a Supabase client using the service role key.
// The service role key bypasses ALL Row Level Security policies.
//
// IMPORTANT: Only call this from:
//   - Server Components (app/dashboard/page.tsx, app/dashboard/print/page.tsx)
//   - API Route handlers (app/api/...)
//
// Never import this in Client Components ('use client').
// Next.js ensures server-only env vars (no NEXT_PUBLIC_ prefix) never reach the browser.

export function createServerSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. ' +
      'Check .env.local and Vercel environment settings.'
    )
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
