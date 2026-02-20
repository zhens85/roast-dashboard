// Shared top navigation for all authenticated portal pages.
// Server component — receives companyName as a prop from the page.

interface PortalNavProps {
  companyName: string
}

export default function PortalNav({ companyName }: PortalNavProps) {
  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo / Brand */}
        <a href="/portal/products" className="flex items-center gap-2 font-bold text-stone-800 hover:text-stone-600">
          <span className="text-xl">☕</span>
          <span>Partner Portal</span>
        </a>

        {/* Nav links */}
        <nav className="flex items-center gap-1 sm:gap-4">
          <a
            href="/portal/products"
            className="text-sm font-medium text-stone-600 hover:text-stone-900 px-2 py-1
                       rounded hover:bg-stone-100 transition-colors"
          >
            Products
          </a>
          <a
            href="/portal/orders"
            className="text-sm font-medium text-stone-600 hover:text-stone-900 px-2 py-1
                       rounded hover:bg-stone-100 transition-colors"
          >
            My Orders
          </a>

          {/* Company name + sign out */}
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-stone-200">
            <span className="text-xs text-stone-500 hidden sm:block">{companyName}</span>
            <form method="POST" action="/api/portal/auth/logout">
              <button
                type="submit"
                className="text-xs text-stone-400 hover:text-stone-700 underline"
              >
                Sign out
              </button>
            </form>
          </div>
        </nav>
      </div>
    </header>
  )
}
