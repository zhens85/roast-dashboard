import { createPortalSupabaseClient } from '@/lib/supabase-portal'
import type { PortalProduct, Partner, TierDiscountRule } from '@/types'
import ProductGrid from './ProductGrid'
import PortalNav from '../PortalNav'

export const dynamic = 'force-dynamic'

async function fetchProductsAndPartner(): Promise<{
  products: PortalProduct[]
  partner: Partner
  discountRules: TierDiscountRule[]
}> {
  const supabase = await createPortalSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: partner, error: partnerError } = await supabase
    .from('partners')
    .select('*, partner_tiers(*, tier_discount_rules(*))')
    .eq('id', user.id)
    .single()

  if (partnerError) throw new Error(`Failed to fetch partner: ${partnerError.message}`)

  const tierId       = partner?.tier_id ?? null
  const discountRules = (partner?.partner_tiers?.tier_discount_rules ?? []) as TierDiscountRule[]

  const { data: allProducts, error: productsError } = await supabase
    .from('products')
    .select('*, product_variants(*)')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (productsError) throw new Error(`Failed to fetch products: ${productsError.message}`)

  const products = ((allProducts ?? []) as PortalProduct[]).filter((p) => {
    if (!p.visible_to_tiers || p.visible_to_tiers.length === 0) return true
    if (tierId === null) return false
    return p.visible_to_tiers.includes(tierId)
  })

  return { products, partner: partner as Partner, discountRules }
}

export default async function PortalProductsPage() {
  const { products, partner, discountRules } = await fetchProductsAndPartner()

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f5f2' }}>
      <PortalNav companyName={partner.company_name} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#3b4858' }}>Our Coffees</h1>
          {discountRules.length > 0 && (
            <p className="text-sm mt-1 font-medium" style={{ color: '#2d7a4f' }}>
              Partner discounts applied — see each product for details.
            </p>
          )}
        </div>

        {products.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center"
               style={{ borderColor: '#e5e5e5', color: '#777777' }}>
            No coffees available at this time.
          </div>
        ) : (
          <ProductGrid products={products} discountRules={discountRules} />
        )}
      </main>
    </div>
  )
}
