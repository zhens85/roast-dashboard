import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

// POST /api/partners/[id]/approve
// Toggles is_approved on the partner. Body: { approved: boolean }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let approved: boolean
  try {
    const body = await request.json()
    if (typeof body.approved !== 'boolean') throw new Error('approved must be a boolean')
    approved = body.approved
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('partners')
    .update({ is_approved: approved })
    .eq('id', id)
    .select('*, partner_tiers(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
