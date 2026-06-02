import { createPortalSupabaseClient } from '@/lib/supabase-portal'
import type { PortalOrder, Partner } from '@/types'
import PortalNav from '../PortalNav'
import OrdersClient from './OrdersClient'

export const dynamic = 'force-dynamic'

export default async function PortalOrdersPage() {
  const supabase = await createPortalSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: partner } = await supabase
    .from('partners')
    .select('*')
    .eq('id', user.id)
    .single()

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
      ),
      partner_locations ( id, name, city, state )
    `)
    .eq('partner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching orders:', error)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f5f2' }}>
      <PortalNav companyName={(partner as Partner)?.company_name ?? ''} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold mb-6" style={{ color: '#3b4858' }}>
          Order History
        </h1>
        <OrdersClient initialOrders={(orders as PortalOrder[]) ?? []} />
      </main>
    </div>
  )
}
