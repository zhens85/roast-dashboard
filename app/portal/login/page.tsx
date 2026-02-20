import { redirect } from 'next/navigation'
import { createPortalSupabaseClient } from '@/lib/supabase-portal'

const ERROR_MESSAGES: Record<string, string> = {
  invalid:       'Incorrect email or password.',
  missing:       'Please enter your email and password.',
  default:       'Something went wrong. Please try again.',
}

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  // If already logged in, skip to products.
  // Wrapped in try/catch so a missing env var doesn't crash the login page itself.
  try {
    const supabase = await createPortalSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect('/portal/products')
  } catch {
    // Not logged in or env var missing — just render the login form
  }

  const errorMsg = params.error ? (ERROR_MESSAGES[params.error] ?? ERROR_MESSAGES.default) : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
      <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">☕</span>
            <h1 className="text-2xl font-bold text-stone-800">Partner Portal</h1>
          </div>
          <p className="text-stone-500 text-sm">Sign in to place your wholesale order</p>
        </div>

        {/* Login form */}
        <form method="POST" action="/api/portal/auth/login" className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800
                         focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800
                         focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {errorMsg && (
            <p className="text-red-600 text-sm">{errorMsg}</p>
          )}

          <button
            type="submit"
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold
                       py-2 rounded-lg transition-colors"
          >
            Sign in
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-stone-500">
          New partner?{' '}
          <a href="/portal/signup" className="text-amber-700 hover:text-amber-900 underline">
            Create an account
          </a>
        </p>

        <p className="mt-2 text-center text-sm text-stone-400">
          <a href="/portal/reset-password" className="hover:text-stone-600 underline">
            Forgot your password?
          </a>
        </p>
      </div>
    </div>
  )
}
