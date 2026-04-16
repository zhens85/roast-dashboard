import { createServerSupabaseClient } from '@/lib/supabase'
import type { GreenLot, BlendRecipe, Product } from '@/types'
import GreenClient from './GreenClient'

export const dynamic = 'force-dynamic'

async function fetchGreenLots(): Promise<GreenLot[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('green_lots')
    .select('*')
    .order('status', { ascending: true })       // active first
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch green lots: ${error.message}`)
  return (data as GreenLot[]) ?? []
}

async function fetchProducts(): Promise<Pick<Product, 'id' | 'name'>[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw new Error(`Failed to fetch products: ${error.message}`)
  return data ?? []
}

async function fetchCurrentBlendRecipes(): Promise<BlendRecipe[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('blend_recipes')
    .select(`
      *,
      products (id, name),
      blend_recipe_items (
        *,
        green_lots (id, lot_number, name, origin)
      )
    `)
    .eq('is_current', true)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch blend recipes: ${error.message}`)
  return (data as BlendRecipe[]) ?? []
}

export default async function GreenPage() {
  const [lots, products, blendRecipes] = await Promise.all([
    fetchGreenLots(),
    fetchProducts(),
    fetchCurrentBlendRecipes(),
  ])

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: '#3b4858' }}>Green Inventory</h1>
        <p className="text-sm mt-1" style={{ color: '#777777' }}>
          Track green coffee lots, weights, and blend recipes.
        </p>
      </div>

      <GreenClient
        initialLots={lots}
        initialProducts={products}
        initialBlendRecipes={blendRecipes}
      />
    </main>
  )
}
