import { createPortalSupabaseClient } from '@/lib/supabase-portal'
import type { Partner, PartnerLocation } from '@/types'
import CartView from './CartView'
import PortalNav from '../PortalNav'

export const dynamic = 'force-dynamic'

export default async function CartPage() {
  const supabase = await createPortalSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: partner }, { data: locations }] = await Promise.all([
    supabase.from('partners').select('*').eq('id', user.id).single(),
    supabase
      .from('partner_locations')
      .select('*')
      .eq('partner_id', user.id)
      .order('is_default', { ascending: false })
      .order('name'),
  ])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f5f2' }}>
      <PortalNav companyName={(partner as Partner)?.company_name ?? ''} />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold mb-6" style={{ color: '#3b4858' }}>Your Cart</h1>
        <CartView initialLocations={(locations as PartnerLocation[]) ?? []} />
      </main>
    </div>
  )
}
