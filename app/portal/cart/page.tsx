import { createPortalSupabaseClient } from '@/lib/supabase-portal'
import type { Partner } from '@/types'
import CartView from './CartView'
import PortalNav from '../PortalNav'

export const dynamic = 'force-dynamic'

export default async function CartPage() {
  const supabase = await createPortalSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: partner } = await supabase
    .from('partners')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-stone-50">
      <PortalNav companyName={(partner as Partner)?.company_name ?? ''} />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-6">Your Cart</h1>
        <CartView />
      </main>
    </div>
  )
}
