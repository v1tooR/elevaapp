import { requireAuth } from '@/lib/auth'
import { AdminLayout } from '@/components/layout/admin-layout'
import { redirect } from 'next/navigation'

export default async function MinhaAreaLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAuth()
  if (profile.role !== 'cliente') redirect('/dashboard')
  return <AdminLayout profile={profile}>{children}</AdminLayout>
}
