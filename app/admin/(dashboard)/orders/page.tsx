import { createServerSupabaseClient } from '@/lib/supabase'
import type { DashboardOrder, AliasMap } from '@/types'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

async function fetchPendingOrders(): Promise<DashboardOrder[]> {
  const supabase = createServerSupabaseClient()

  const today = new Date().toISOString().split('T')[0]  // YYYY-MM-DD

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
    // Only surface orders whose scheduled_for date has arrived (or has no scheduled date)
    .or(`scheduled_for.is.null,scheduled_for.lte.${today}`)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch pending orders: ${error.message}`)
  return (data as DashboardOrder[]) ?? []
}

// Build a fully-resolved alias map for use in roast calculations.
// Fetches product_aliases and joins the canonical product's name + loss factor
// so the calculation layer doesn't need to do any additional lookups.
async function fetchAliasMap(): Promise<AliasMap> {
  const supabase = createServerSupabaseClient()

  // Step 1: get all alias rows
  const { data: aliases, error: aliasError } = await supabase
    .from('product_aliases')
    .select('alias_product_id, canonical_product_id')

  if (aliasError || !aliases || aliases.length === 0) return {}  // table may not exist yet

  // Step 2: fetch canonical product details
  const canonicalIds = [...new Set(aliases.map((a) => a.canonical_product_id))]
  const { data: canonicals, error: productError } = await supabase
    .from('products')
    .select('id, name, roast_loss_factor')
    .in('id', canonicalIds)

  if (productError || !canonicals) return {}

  const canonicalById = Object.fromEntries(canonicals.map((p) => [p.id, p]))

  // Step 3: build the resolved map
  const aliasMap: AliasMap = {}
  for (const alias of aliases) {
    const canonical = canonicalById[alias.canonical_product_id]
    if (!canonical) continue
    aliasMap[alias.alias_product_id] = {
      id:         canonical.id,
      name:       canonical.name,
      lossFactor: Number(canonical.roast_loss_factor),
    }
  }

  return aliasMap
}

export default async function DashboardPage() {
  const [orders, aliasMap] = await Promise.all([fetchPendingOrders(), fetchAliasMap()])

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: '#3b4858' }}>Roast Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: '#777777' }}>
          {orders.length} pending order{orders.length !== 1 ? 's' : ''}
        </p>
      </div>

      <DashboardClient initialOrders={orders} initialAliasMap={aliasMap} />
    </main>
  )
}
