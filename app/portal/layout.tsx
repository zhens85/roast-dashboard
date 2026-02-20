import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Partner Portal',
  description: 'Wholesale coffee ordering portal',
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      {children}
    </div>
  )
}
