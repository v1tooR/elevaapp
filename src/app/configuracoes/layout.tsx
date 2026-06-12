import { requireAuth } from '@/lib/auth'
import { AdminLayout } from '@/components/layout/admin-layout'

export default async function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAuth(['super_admin', 'admin'])
  return <AdminLayout profile={profile}>{children}</AdminLayout>
}
