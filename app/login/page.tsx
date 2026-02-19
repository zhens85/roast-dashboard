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
    redirect(params.redirect ?? '/dashboard')
  }

  const redirectTo = params.redirect ?? '/dashboard'
  const hasError   = params.error === 'invalid'

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-800">Roast Dashboard</h1>
          <p className="text-stone-500 text-sm mt-1">Operations access only</p>
        </div>

        <form method="POST" action="/api/auth/login" className="space-y-4">
          <input type="hidden" name="redirect" value={redirectTo} />

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-stone-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800
                         focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {hasError && (
            <p className="text-red-600 text-sm">Incorrect password. Try again.</p>
          )}

          <button
            type="submit"
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold
                       py-2 rounded-lg transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
