import { createServerSupabaseClient } from '@/lib/supabase'
import type { Product, ProductVariant, ProductAlias } from '@/types'
import ProductsClient from './ProductsClient'

export const dynamic = 'force-dynamic'

export interface ProductWithVariants extends Product {
  product_variants: ProductVariant[]
}

async function fetchProducts(): Promise<ProductWithVariants[]> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('products')
    .select('*, product_variants(*)')
    .order('name', { ascending: true })

  if (error) throw new Error(`Failed to fetch products: ${error.message}`)
  return (data as ProductWithVariants[]) ?? []
}

// Fetch all alias mappings as a flat list.
// Returns [] if the table doesn't exist yet (migration pending) — page still works.
async function fetchAliases(): Promise<Pick<ProductAlias, 'alias_product_id' | 'canonical_product_id'>[]> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('product_aliases')
    .select('alias_product_id, canonical_product_id')

  if (error) return []   // table may not exist yet — degrade gracefully
  return data ?? []
}

export default async function ProductsPage() {
  const [products, aliases] = await Promise.all([fetchProducts(), fetchAliases()])

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: '#3b4858' }}>Products</h1>
        <p className="text-sm mt-1" style={{ color: '#777777' }}>
          Manage your coffee offerings, pricing, and roast aliases.
        </p>
      </div>

      <ProductsClient initialProducts={products} initialAliases={aliases} />
    </main>
  )
}
