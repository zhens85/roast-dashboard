// Shared top navigation for all authenticated portal pages.

interface PortalNavProps {
  companyName: string
}

export default function PortalNav({ companyName }: PortalNavProps) {
  return (
    <header className="bg-white border-b sticky top-0 z-20" style={{ borderColor: '#e5e5e5' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <a href="/portal/products" className="flex-shrink-0">
          <img
            src="//goodfolkscoffee.com/cdn/shop/files/goodfolkshorizontal_383x200.png?v=1614392019"
            alt="Good Folks Coffee"
            className="h-7 w-auto object-contain"
          />
        </a>

        {/* Nav links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <a
            href="/portal/products"
            className="text-sm font-medium px-3 py-1.5 rounded transition-colors hover:bg-gray-50"
            style={{ color: '#466c7e' }}
          >
            Products
          </a>
          <a
            href="/portal/orders"
            className="text-sm font-medium px-3 py-1.5 rounded transition-colors hover:bg-gray-50"
            style={{ color: '#466c7e' }}
          >
            My Orders
          </a>

          {/* Company name + sign out */}
          <div className="flex items-center gap-2 ml-1 pl-3 border-l" style={{ borderColor: '#e5e5e5' }}>
            <span className="text-xs hidden sm:block truncate max-w-[120px]"
                  style={{ color: '#777777' }}>
              {companyName}
            </span>
            <form method="POST" action="/api/portal/auth/logout">
              <button
                type="submit"
                className="text-xs underline hover:opacity-70 transition-opacity"
                style={{ color: '#999' }}
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
