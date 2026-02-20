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
            Reset Password
          </h1>
          <p className="text-sm mt-1 text-center" style={{ color: '#777777' }}>
            Enter your account email and we&apos;ll send you a reset link.
          </p>
        </div>

        {sent ? (
          /* ── Success state ── */
          <div className="space-y-4">
            <div className="rounded-lg p-4 text-sm"
                 style={{ backgroundColor: '#eaf4ef', color: '#2d7a4f' }}>
              Check your inbox — if that email is registered, a reset link is on its way.
              It may take a minute or two to arrive.
            </div>
            <a
              href="/portal/login"
              className="block text-center text-sm underline hover:opacity-70 transition-opacity"
              style={{ color: '#466c7e' }}
            >
              ← Back to sign in
            </a>
          </div>
        ) : (
          /* ── Request form ── */
          <form method="POST" action="/api/portal/auth/reset-password" className="space-y-4">
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
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: '#d0d0d0', color: '#3b4858' }}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: '#d60000' }}>
                Something went wrong. Please try again.
              </p>
            )}

            <button
              type="submit"
              className="w-full text-white font-semibold py-2.5 rounded-lg transition-opacity
                         hover:opacity-90 text-sm"
              style={{ backgroundColor: '#466c7e' }}
            >
              Send reset link
            </button>

            <a
              href="/portal/login"
              className="block text-center text-sm underline hover:opacity-70 transition-opacity"
              style={{ color: '#999' }}
            >
              ← Back to sign in
            </a>
          </form>
        )}
      </div>
    </div>
  )
}
