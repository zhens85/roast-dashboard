import { createServerSupabaseClient } from '@/lib/supabase'
import type { Partner, PartnerTier } from '@/types'
import PartnersClient from './PartnersClient'

export const dynamic = 'force-dynamic'

async function fetchData(): Promise<{ partners: Partner[]; tiers: PartnerTier[] }> {
  const supabase = createServerSupabaseClient()

  const [partnersRes, tiersRes] = await Promise.all([
    supabase
      .from('partners')
      .select('*, partner_tiers(*)')
      .order('company_name', { ascending: true }),
    supabase
      .from('partner_tiers')
      .select('*')
      .order('name', { ascending: true }),
  ])

  if (partnersRes.error) throw new Error(`Partners: ${partnersRes.error.message}`)
  if (tiersRes.error)    throw new Error(`Tiers: ${tiersRes.error.message}`)

  return {
    partners: partnersRes.data as Partner[],
    tiers:    tiersRes.data as PartnerTier[],
  }
}

export default async function PartnersPage() {
  const { partners, tiers } = await fetchData()

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: '#3b4858' }}>Partners</h1>
        <p className="text-sm mt-1" style={{ color: '#777777' }}>
          Create and manage wholesale partner accounts.
        </p>
      </div>

      <PartnersClient initialPartners={partners} tiers={tiers} />
    </main>
  )
}
