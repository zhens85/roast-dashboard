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

  // Fetch partner profile first — we need tier_id to filter products
  const { data: partner, error: partnerError } = await supabase
    .from('partners')
    .select('*, partner_tiers(*)')
    .eq('id', user.id)
    .single()

  if (partnerError) throw new Error(`Failed to fetch partner: ${partnerError.message}`)

  const tierId     = partner?.tier_id ?? null
  const discountPct = partner?.partner_tiers
    ? Number(partner.partner_tiers.discount_pct)
    : 0

  // Fetch all active products with their variants
  const { data: allProducts, error: productsError } = await supabase
    .from('products')
    .select(`
      *,
      product_variants (*)
    `)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (productsError) throw new Error(`Failed to fetch products: ${productsError.message}`)

  // Filter by tier visibility:
  // visible_to_tiers = null or [] means visible to everyone.
  // Otherwise only show products that include this partner's tier_id.
  const products = ((allProducts ?? []) as PortalProduct[]).filter((p) => {
    if (!p.visible_to_tiers || p.visible_to_tiers.length === 0) return true
    if (tierId === null) return false
    return p.visible_to_tiers.includes(tierId)
  })

  return {
    products,
    partner: partner as Partner,
    discountPct,
  }
}

export default async function PortalProductsPage() {
  const { products, partner, discountPct } = await fetchProductsAndPartner()

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f5f2' }}>
      <PortalNav companyName={partner.company_name} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#3b4858' }}>Our Coffees</h1>
          {discountPct > 0 && (
            <p className="text-sm mt-1 font-medium" style={{ color: '#2d7a4f' }}>
              Your partner discount of {discountPct}% is applied automatically.
            </p>
          )}
        </div>

        {products.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center"
               style={{ borderColor: '#e5e5e5', color: '#777777' }}>
            No coffees available at this time.
          </div>
        ) : (
          <ProductGrid products={products} discountPct={discountPct} />
        )}
      </main>
    </div>
  )
}
