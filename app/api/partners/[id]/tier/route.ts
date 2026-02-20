import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

// PATCH /api/partners/[id]/tier — assign or remove a partner's tier
// Body: { tier_id: number | null }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: partnerId } = await params

  let tierId: number | null
  try {
    const body = await request.json()
    tierId = body.tier_id === null ? null : Number(body.tier_id)
    if (tierId !== null && isNaN(tierId)) throw new Error('tier_id must be a number or null')
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message ?? 'Invalid body' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('partners')
    .update({ tier_id: tierId })
    .eq('id', partnerId)
    .select('id, company_name, tier_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
