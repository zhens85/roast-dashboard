import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Partner Portal',
  description: 'Wholesale coffee ordering portal',
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f5f2' }}>
      {children}
    </div>
  )
}
