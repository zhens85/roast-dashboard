import { createServerSupabaseClient } from '@/lib/supabase'
import type { DashboardOrder } from '@/types'
import DashboardClient from './DashboardClient'

// Always fetch fresh data — orders change frequently
export const dynamic = 'force-dynamic'

async function fetchPendingOrders(): Promise<DashboardOrder[]> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      partners (*),
      order_items (
        *,
        product_variants (
          *,
          products (*)
        )
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch pending orders: ${error.message}`)
  }

  return (data as DashboardOrder[]) ?? []
}

export default async function DashboardPage() {
  const orders = await fetchPendingOrders()

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-stone-900">Roast Dashboard</h1>
        <p className="text-stone-500 text-sm mt-1">
          {orders.length} pending order{orders.length !== 1 ? 's' : ''}
        </p>
      </div>

      <DashboardClient initialOrders={orders} />
    </main>
  )
}
