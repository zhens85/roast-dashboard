import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Creates a Supabase client for the partner portal — server-side only.
//
// Uses the anon key + the partner's Supabase Auth session (stored in cookies).
// Row Level Security is fully enforced: each partner only sees their own data.
//
// Use this in:
//   - Portal Server Components (app/portal/*/page.tsx)
//   - Portal API routes (app/api/portal/*)
//
// Do NOT use createServerSupabaseClient() (service role) for portal routes —
// that would bypass RLS and expose all partners' data.

export async function createPortalSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components have a read-only cookie store — ignore
          }
        },
      },
    }
  )
}
