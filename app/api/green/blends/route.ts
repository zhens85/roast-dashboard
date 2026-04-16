import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// GET /api/green/blends?product_id=N — fetch all recipes (all versions) for a product
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const productId = parseInt(searchParams.get('product_id') ?? '', 10)
  if (isNaN(productId)) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })

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
    .eq('product_id', productId)
    .order('version', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/green/blends — create a new blend recipe (increments version, marks old as not current)
export async function POST(req: NextRequest) {
  let body: {
    product_id: number
    notes?: string | null
    items: { green_lot_id: number; percentage: number }[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { product_id, items } = body

  if (!product_id) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })
  if (!items || items.length === 0) return NextResponse.json({ error: 'items array is required' }, { status: 400 })

  // Validate percentages sum to 100
  const total = items.reduce((sum, item) => sum + Number(item.percentage), 0)
  if (Math.abs(total - 100) > 0.01) {
    return NextResponse.json(
      { error: `Percentages must sum to 100 (got ${total.toFixed(2)})` },
      { status: 400 }
    )
  }

  const supabase = createServerSupabaseClient()

  // Find current max version for this product
  const { data: existing } = await supabase
    .from('blend_recipes')
    .select('id, version')
    .eq('product_id', product_id)
    .order('version', { ascending: false })
    .limit(1)

  const maxVersion = existing?.[0]?.version ?? 0
  const nextVersion = maxVersion + 1

  // Mark all current recipes for this product as not current
  const { error: markErr } = await supabase
    .from('blend_recipes')
    .update({ is_current: false })
    .eq('product_id', product_id)
    .eq('is_current', true)

  if (markErr) {
    console.error('blend_recipes mark old error:', markErr)
    return NextResponse.json({ error: markErr.message }, { status: 500 })
  }

  // Create the new recipe
  const { data: recipe, error: recipeErr } = await supabase
    .from('blend_recipes')
    .insert({
      product_id,
      version:    nextVersion,
      is_current: true,
      notes:      body.notes ?? null,
    })
    .select()
    .single()

  if (recipeErr) {
    console.error('blend_recipes insert error:', recipeErr)
    return NextResponse.json({ error: recipeErr.message }, { status: 500 })
  }

  // Insert all items
  const { error: itemsErr } = await supabase
    .from('blend_recipe_items')
    .insert(
      items.map((item) => ({
        blend_recipe_id: recipe.id,
        green_lot_id:    item.green_lot_id,
        percentage:      item.percentage,
      }))
    )

  if (itemsErr) {
    console.error('blend_recipe_items insert error:', itemsErr)
    return NextResponse.json({ error: itemsErr.message }, { status: 500 })
  }

  // Return the full recipe with items and lot info
  const { data: full, error: fetchErr } = await supabase
    .from('blend_recipes')
    .select(`
      *,
      products (id, name),
      blend_recipe_items (
        *,
        green_lots (id, lot_number, name, origin)
      )
    `)
    .eq('id', recipe.id)
    .single()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  return NextResponse.json(full, { status: 201 })
}
