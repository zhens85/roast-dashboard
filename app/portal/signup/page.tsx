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
    <div className="min-h-screen flex items-center justify-center px-4 py-10"
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
            Create Account
          </h1>
          <p className="text-sm mt-1" style={{ color: '#777777' }}>
            Set up your wholesale partner account
          </p>
        </div>

        {/* Signup form */}
        <form method="POST" action="/api/portal/auth/signup" className="space-y-4">
          <div>
            <label htmlFor="company_name" className="block text-sm font-medium mb-1"
                   style={{ color: '#3b4858' }}>
              Company Name
            </label>
            <input
              id="company_name"
              name="company_name"
              type="text"
              required
              autoFocus
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: '#d0d0d0', color: '#3b4858' }}
            />
          </div>

          <div>
            <label htmlFor="contact_person" className="block text-sm font-medium mb-1"
                   style={{ color: '#3b4858' }}>
              Contact Name
            </label>
            <input
              id="contact_person"
              name="contact_person"
              type="text"
              required
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: '#d0d0d0', color: '#3b4858' }}
            />
          </div>

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
              autoComplete="email"
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: '#d0d0d0', color: '#3b4858' }}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1"
                   style={{ color: '#3b4858' }}>
              Password{' '}
              <span className="font-normal" style={{ color: '#999' }}>(min. 8 characters)</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: '#d0d0d0', color: '#3b4858' }}
            />
          </div>

          {errorMsg && (
            <p className="text-sm" style={{ color: '#d60000' }}>{errorMsg}</p>
          )}

          <button
            type="submit"
            className="w-full text-white font-semibold py-2.5 rounded-lg transition-opacity hover:opacity-90 text-sm"
            style={{ backgroundColor: '#466c7e' }}
          >
            Create Account
          </button>
        </form>

        <p className="mt-5 text-center text-sm" style={{ color: '#777777' }}>
          Already have an account?{' '}
          <a href="/portal/login"
             className="font-medium underline hover:opacity-70 transition-opacity"
             style={{ color: '#466c7e' }}>
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
