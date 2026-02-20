import { redirect } from 'next/navigation'
import { createPortalSupabaseClient } from '@/lib/supabase-portal'

const ERROR_MESSAGES: Record<string, string> = {
  missing:        'Please fill in all required fields.',
  password_short: 'Password must be at least 8 characters.',
  email_taken:    'An account with that email already exists.',
  auth_error:     'Could not create account. Please try again.',
  profile_error:  'Account created but profile setup failed. Please contact support.',
  default:        'Something went wrong. Please try again.',
}

export default async function PortalSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  // Already logged in — wrapped in try/catch so a missing env var doesn't crash the page
  try {
    const supabase = await createPortalSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect('/portal/products')
  } catch {
    // Not logged in or env var missing — just render the signup form
  }

  const errorMsg = params.error ? (ERROR_MESSAGES[params.error] ?? ERROR_MESSAGES.default) : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4 py-10">
      <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">☕</span>
            <h1 className="text-2xl font-bold text-stone-800">Create Account</h1>
          </div>
          <p className="text-stone-500 text-sm">Set up your wholesale partner account</p>
        </div>

        {/* Signup form */}
        <form method="POST" action="/api/portal/auth/signup" className="space-y-4">
          <div>
            <label htmlFor="company_name" className="block text-sm font-medium text-stone-700 mb-1">
              Company Name
            </label>
            <input
              id="company_name"
              name="company_name"
              type="text"
              required
              autoFocus
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800
                         focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label htmlFor="contact_person" className="block text-sm font-medium text-stone-700 mb-1">
              Contact Name
            </label>
            <input
              id="contact_person"
              name="contact_person"
              type="text"
              required
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800
                         focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800
                         focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1">
              Password
              <span className="text-stone-400 font-normal ml-1">(min. 8 characters)</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
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
            Create Account
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-stone-500">
          Already have an account?{' '}
          <a href="/portal/login" className="text-amber-700 hover:text-amber-900 underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
