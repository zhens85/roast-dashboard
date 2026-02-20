import { createPortalSupabaseClient } from '@/lib/supabase-portal'
import type { PortalProduct, Partner } from '@/types'
import ProductGrid from './ProductGrid'
import PortalNav from '../PortalNav'

export const dynamic = 'force-dynamic'

async function fetchProductsAndPartner(): Promise<{
  products: PortalProduct[]
  partner: Partner
  discountPct: number
}> {
  const supabase = await createPortalSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Fetch products with variants — RLS automatically filters by tier
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(`
      *,
      product_variants (*)
    `)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (productsError) throw new Error(`Failed to fetch products: ${productsError.message}`)

  // Fetch partner profile with tier info for discount
  const { data: partner, error: partnerError } = await supabase
    .from('partners')
    .select('*, partner_tiers(*)')
    .eq('id', user.id)
    .single()

  if (partnerError) throw new Error(`Failed to fetch partner: ${partnerError.message}`)

  const discountPct = partner?.partner_tiers
    ? Number(partner.partner_tiers.discount_pct)
    : 0

  return {
    products: (products as PortalProduct[]) ?? [],
    partner: partner as Partner,
    discountPct,
  }
}

export default async function PortalProductsPage() {
  const { products, partner, discountPct } = await fetchProductsAndPartner()

  return (
    <div className="min-h-screen bg-stone-50">
      <PortalNav companyName={partner.company_name} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-900">Our Coffees</h1>
          {discountPct > 0 && (
            <p className="text-sm text-emerald-700 mt-1 font-medium">
              Your partner discount of {discountPct}% is applied automatically.
            </p>
          )}
        </div>

        {products.length === 0 ? (
          <div className="bg-white rounded-lg border border-stone-200 p-12 text-center text-stone-500">
            No coffees available at this time.
          </div>
        ) : (
          <ProductGrid products={products} discountPct={discountPct} />
        )}
      </main>
    </div>
  )
}
