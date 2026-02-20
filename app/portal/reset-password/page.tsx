// /portal/reset-password — partner requests a password-reset email.
// After submission (success or failure) shows a "check your email" message.

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>
}) {
  const params = await searchParams
  const sent   = params.sent === '1'
  const error  = params.error === 'invalid'

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
      <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">☕</span>
            <h1 className="text-2xl font-bold text-stone-800">Reset Password</h1>
          </div>
          <p className="text-stone-500 text-sm">
            Enter your account email and we&apos;ll send you a reset link.
          </p>
        </div>

        {sent ? (
          /* ── Success state ── */
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
              Check your inbox — if that email is registered, a reset link is on its way.
              It may take a minute or two to arrive.
            </div>
            <a
              href="/portal/login"
              className="block text-center text-sm text-amber-700 hover:text-amber-900 underline"
            >
              ← Back to sign in
            </a>
          </div>
        ) : (
          /* ── Request form ── */
          <form method="POST" action="/api/portal/auth/reset-password" className="space-y-4">
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

            {error && (
              <p className="text-red-600 text-sm">
                Something went wrong. Please try again.
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold
                         py-2 rounded-lg transition-colors"
            >
              Send reset link
            </button>

            <a
              href="/portal/login"
              className="block text-center text-sm text-stone-500 hover:text-stone-700 underline"
            >
              ← Back to sign in
            </a>
          </form>
        )}
      </div>
    </div>
  )
}
