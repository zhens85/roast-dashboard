// Staff dashboard layout — adds a nav bar with Orders | Tiers links.
// Wraps all /dashboard/* pages.

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-100">
      {/* Staff nav bar */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <nav className="flex items-center gap-1">
            <a
              href="/dashboard"
              className="text-sm font-semibold text-stone-700 hover:text-stone-900 px-3 py-1.5
                         rounded hover:bg-stone-100 transition-colors"
            >
              Orders
            </a>
            <a
              href="/dashboard/tiers"
              className="text-sm font-semibold text-stone-700 hover:text-stone-900 px-3 py-1.5
                         rounded hover:bg-stone-100 transition-colors"
            >
              Tiers
            </a>
          </nav>

          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-xs text-stone-400 hover:text-stone-700 underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {children}
    </div>
  )
}
