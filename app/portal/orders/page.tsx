import { createPortalSupabaseClient } from '@/lib/supabase-portal'
import type { PortalOrder, Partner } from '@/types'
import PortalNav from '../PortalNav'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped:   'bg-purple-100 text-purple-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-stone-100 text-stone-500',
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
    <div className="min-h-screen bg-stone-50">
      <PortalNav companyName={(partner as Partner)?.company_name ?? ''} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-6">Order History</h1>

        {typedOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
            <p className="text-stone-500 mb-4">No orders yet.</p>
            <a
              href="/portal/products"
              className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-semibold
                         px-5 py-2 rounded-lg transition-colors"
            >
              Browse Coffees
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {typedOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-stone-200 overflow-hidden"
              >
                {/* Order header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-stone-800">Order #{order.id}</span>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize
                                     ${STATUS_STYLES[order.status] ?? 'bg-stone-100 text-stone-600'}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-stone-800">{fmtPrice(order.total_amount_cents)}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
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
                  {order.order_items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm text-stone-700">
                      <span>
                        <span className="font-medium">{item.quantity}×</span>{' '}
                        {item.product_variants.products.name}{' '}
                        <span className="text-stone-500">{item.product_variants.size}</span>
                      </span>
                      <span className="text-stone-500">
                        {fmtPrice(item.unit_price_cents * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                {order.notes && (
                  <div className="px-5 pb-4">
                    <p className="text-xs text-amber-700 italic">Note: {order.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
