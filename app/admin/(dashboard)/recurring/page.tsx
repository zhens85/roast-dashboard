import { createServerSupabaseClient } from '@/lib/supabase'
import RecurringClient from './RecurringClient'

export const dynamic = 'force-dynamic'

export default async function RecurringPage() {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      partners ( id, company_name, email, contact_person, phone ),
      order_items (
        *,
        product_variants ( *, products ( id, name ) )
      )
    `)
    .eq('is_recurring', true)
    .not('status', 'in', '("cancelled","archived")')
    // Sort nulls-first (immediate), then by date ascending, paused (2099) at end
    .order('scheduled_for', { ascending: true, nullsFirst: true })

  if (error) {
    return (
      <main className="p-6 max-w-5xl mx-auto">
        <p className="text-red-600 text-sm">Failed to load recurring orders: {error.message}</p>
      </main>
    )
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: '#3b4858' }}>Recurring Orders</h1>
        <p className="text-sm mt-1" style={{ color: '#777777' }}>
          {data?.length ?? 0} active recurring order{(data?.length ?? 0) !== 1 ? 's' : ''}
        </p>
      </div>

      <RecurringClient initialOrders={data ?? []} />
    </main>
  )
}
