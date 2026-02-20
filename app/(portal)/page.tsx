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
  try {
    const supabase = await createPortalSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) redirect('/products')
  } catch {
    // Not logged in or env var missing — just render the login form
  }

  const errorMsg = params.error ? (ERROR_MESSAGES[params.error] ?? ERROR_MESSAGES.default) : null

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ backgroundColor: '#f7f5f2' }}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="//goodfolkscoffee.com/cdn/shop/files/goodfolkshorizontal_383x200.png?v=1614392019"
            alt="Good Folks Coffee"
            className="h-12 w-auto object-contain mb-5"
          />
          <h1 className="text-lg font-semibold" style={{ color: '#3b4858' }}>
            Partner Portal
          </h1>
          <p className="text-sm mt-1" style={{ color: '#777777' }}>
            Sign in to place your wholesale order
          </p>
        </div>

        {/* Login form */}
        <form method="POST" action="/api/portal/auth/login" className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1"
                   style={{ color: '#3b4858' }}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              className="w-full border rounded-lg px-3 py-2.5 text-sm transition-colors
                         focus:outline-none focus:ring-2"
              style={{
                borderColor: '#d0d0d0',
                color: '#3b4858',
              }}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1"
                   style={{ color: '#3b4858' }}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full border rounded-lg px-3 py-2.5 text-sm transition-colors
                         focus:outline-none focus:ring-2"
              style={{
                borderColor: '#d0d0d0',
                color: '#3b4858',
              }}
            />
          </div>

          {errorMsg && (
            <p className="text-sm" style={{ color: '#d60000' }}>{errorMsg}</p>
          )}

          <button
            type="submit"
            className="w-full text-white font-semibold py-2.5 rounded-lg transition-opacity
                       hover:opacity-90 text-sm"
            style={{ backgroundColor: '#466c7e' }}
          >
            Sign in
          </button>
        </form>

        <div className="mt-5 space-y-2 text-center">
          <p className="text-sm" style={{ color: '#777777' }}>
            New partner?{' '}
            <a href="/signup"
               className="font-medium underline hover:opacity-70 transition-opacity"
               style={{ color: '#466c7e' }}>
              Create an account
            </a>
          </p>
          <p className="text-sm" style={{ color: '#999' }}>
            <a href="/reset-password"
               className="underline hover:opacity-70 transition-opacity"
               style={{ color: '#999' }}>
              Forgot your password?
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
