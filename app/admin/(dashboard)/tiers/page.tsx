import { createServerSupabaseClient } from '@/lib/supabase'
import type { PartnerTier, Partner, Product } from '@/types'
import TiersClient from './TiersClient'

export const dynamic = 'force-dynamic'

async function fetchTiersData(): Promise<{
  tiers: PartnerTier[]
  partners: Partner[]
  products: Pick<Product, 'id' | 'name' | 'visible_to_tiers'>[]
}> {
  const supabase = createServerSupabaseClient()

  const [tiersRes, partnersRes, productsRes] = await Promise.all([
    supabase
      .from('partner_tiers')
      .select('*, tier_discount_rules(*)')
      .order('name', { ascending: true }),

    supabase
      .from('partners')
      .select('*, partner_tiers(*, tier_discount_rules(*))')
      .order('company_name', { ascending: true }),

    supabase
      .from('products')
      .select('id, name, visible_to_tiers')
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ])

  if (tiersRes.error)    throw new Error(`Tiers: ${tiersRes.error.message}`)
  if (partnersRes.error) throw new Error(`Partners: ${partnersRes.error.message}`)
  if (productsRes.error) throw new Error(`Products: ${productsRes.error.message}`)

  return {
    tiers:    tiersRes.data as PartnerTier[],
    partners: partnersRes.data as Partner[],
    products: productsRes.data as Pick<Product, 'id' | 'name' | 'visible_to_tiers'>[],
  }
}

export default async function TiersPage() {
  const { tiers, partners, products } = await fetchTiersData()

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: '#3b4858' }}>Partner Tiers</h1>
        <p className="text-sm mt-1" style={{ color: '#777777' }}>
          Manage tiers, assign partners, and control product visibility.
        </p>
      </div>

      <TiersClient
        initialTiers={tiers}
        initialPartners={partners}
        initialProducts={products}
      />
    </main>
  )
}
