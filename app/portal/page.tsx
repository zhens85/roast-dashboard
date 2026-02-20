import { redirect } from 'next/navigation'

// /portal → /portal/products
export default function PortalRootPage() {
  redirect('/portal/products')
}
