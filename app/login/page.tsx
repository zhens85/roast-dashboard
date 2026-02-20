import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>
}) {
  const params = await searchParams
  const cookieStore = await cookies()
  const session = cookieStore.get('roast_session')

  if (session?.value === 'authenticated') {
    redirect(params.redirect ?? '/admin')
  }

  const redirectTo = params.redirect ?? '/admin'
  const hasError   = params.error === 'invalid'

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ backgroundColor: '#f7f5f2' }}>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img
            src="//goodfolkscoffee.com/cdn/shop/files/goodfolkshorizontal_383x200.png?v=1614392019"
            alt="Good Folks Coffee"
            className="h-10 w-auto object-contain"
          />
        </div>

        <div className="mb-5 text-center">
          <h1 className="text-lg font-semibold" style={{ color: '#3b4858' }}>Operations</h1>
          <p className="text-sm mt-0.5" style={{ color: '#999' }}>Staff access only</p>
        </div>

        <form method="POST" action="/api/auth/login" className="space-y-4">
          <input type="hidden" name="redirect" value={redirectTo} />

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium mb-1"
              style={{ color: '#777' }}
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              className="w-full border rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2"
              style={{ borderColor: '#d0d0d0', color: '#3b4858' }}
            />
          </div>

          {hasError && (
            <p className="text-sm" style={{ color: '#d60000' }}>Incorrect password. Try again.</p>
          )}

          <button
            type="submit"
            className="w-full text-white font-semibold py-2 rounded-lg
                       hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#466c7e' }}
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
