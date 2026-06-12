import { requireAuth } from '@/lib/auth'
import { AdminLayout } from '@/components/layout/admin-layout'

export default async function NotificacoesLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAuth(['super_admin', 'admin', 'analista'])
  return <AdminLayout profile={profile}>{children}</AdminLayout>
}
