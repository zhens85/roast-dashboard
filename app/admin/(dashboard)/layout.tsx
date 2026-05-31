// Staff dashboard layout — sticky nav bar wrapping all /admin/* pages.
import type { ReactNode } from 'react'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f5f2' }}>
      {/* Staff nav bar */}
      <header className="bg-white border-b sticky top-0 z-20" style={{ borderColor: '#e5e5e5' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-13 flex items-center justify-between gap-6">

          {/* Logo */}
          <a href="/admin/orders" className="flex-shrink-0 py-2">
            <img
              src="//goodfolkscoffee.com/cdn/shop/files/goodfolkshorizontal_383x200.png?v=1614392019"
              alt="Good Folks Coffee"
              className="h-6 w-auto object-contain"
            />
          </a>

          {/* Nav links */}
          <nav className="flex items-center gap-0.5 flex-1">
            {[
              { href: '/admin/orders',    label: 'Orders'    },
              { href: '/admin/recurring', label: 'Recurring' },
              { href: '/admin/green',     label: 'Green'     },
              { href: '/admin/products',  label: 'Products'  },
              { href: '/admin/partners',  label: 'Partners'  },
              { href: '/admin/tiers',     label: 'Tiers'     },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="text-sm font-medium px-3 py-2 rounded transition-colors hover:bg-gray-50"
                style={{ color: '#3b4858' }}
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Sign out */}
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-xs underline hover:opacity-70 transition-opacity"
              style={{ color: '#999' }}
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
