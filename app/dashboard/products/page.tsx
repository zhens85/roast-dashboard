import { createServerSupabaseClient } from '@/lib/supabase'
import type { Product, ProductVariant } from '@/types'
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

export default async function ProductsPage() {
  const products = await fetchProducts()

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-stone-900">Products</h1>
        <p className="text-stone-500 text-sm mt-1">
          Manage your coffee offerings and pricing.
        </p>
      </div>

      <ProductsClient initialProducts={products} />
    </main>
  )
}
