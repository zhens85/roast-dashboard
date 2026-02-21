import { createPortalSupabaseClient } from '@/lib/supabase-portal'
import type { PortalOrder, Partner } from '@/types'
import PortalNav from '../PortalNav'

export const dynamic = 'force-dynamic'

// Status chip colours — background / text as inline style objects
const STATUS_STYLE: Record<string, { background: string; color: string }> = {
  pending:   { background: '#fef3cd', color: '#7a5c00' },
  confirmed: { background: '#dbeafe', color: '#1e4d91' },
  shipped:   { background: '#ede9fe', color: '#5b21b6' },
  delivered: { background: '#d1fae5', color: '#065f46' },
  cancelled: { background: '#f3f4f6', color: '#6b7280' },
}

function fmtPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export default async function PortalOrdersPage() {
  const supabase = await createPortalSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch partner profile for nav
  const { data: partner } = await supabase
    .from('partners')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch order history for this partner
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        *,
        product_variants (
          *,
          products ( id, name )
        )
      )
    `)
    .eq('partner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching orders:', error)
  }

  const typedOrders = (orders as PortalOrder[]) ?? []

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f5f2' }}>
      <PortalNav companyName={(partner as Partner)?.company_name ?? ''} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold mb-6" style={{ color: '#3b4858' }}>Order History</h1>

        {typedOrders.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center"
               style={{ borderColor: '#e5e5e5' }}>
            <p className="mb-4" style={{ color: '#777777' }}>No orders yet.</p>
            <a
              href="/products"
              className="inline-block text-white font-semibold px-5 py-2 rounded-lg
                         transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#466c7e' }}
            >
              Browse Coffees
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {typedOrders.map((order) => {
              const chipStyle = STATUS_STYLE[order.status] ?? { background: '#f3f4f6', color: '#6b7280' }
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl border overflow-hidden"
                  style={{ borderColor: '#e5e5e5' }}
                >
                  {/* Order header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b"
                       style={{ borderColor: '#f0f0f0' }}>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold" style={{ color: '#3b4858' }}>
                        Order #{order.id}
                      </span>
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full capitalize"
                            style={chipStyle}>
                        {order.status}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold" style={{ color: '#3b4858' }}>
                        {fmtPrice(order.total_amount_cents)}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#999' }}>
                        {new Date(order.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day:   'numeric',
                          year:  'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Order items */}
                  <div className="px-5 py-3 space-y-1">
                    {order.order_items.map((item) => {
                      const variant  = item.product_variants
                      const name     = variant?.products?.name ?? 'Unknown product'
                      const size     = variant?.size ?? ''
                      return (
                        <div key={item.id} className="flex justify-between text-sm"
                             style={{ color: '#555' }}>
                          <span>
                            <span className="font-medium">{item.quantity}×</span>{' '}
                            {name}{' '}
                            <span style={{ color: '#999' }}>{size}</span>
                          </span>
                          <span style={{ color: '#777' }}>
                            {fmtPrice(item.unit_price_cents * item.quantity)}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Notes */}
                  {order.notes && (
                    <div className="px-5 pb-4">
                      <p className="text-xs italic" style={{ color: '#466c7e' }}>
                        Note: {order.notes}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
