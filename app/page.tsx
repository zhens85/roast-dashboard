import { redirect } from 'next/navigation'

// Root URL → partner portal login
// Staff access the dashboard directly at /dashboard
export default function RootPage() {
  redirect('/portal/login')
}
