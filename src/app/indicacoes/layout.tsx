import { AdminLayout } from '@/components/layout/admin-layout'
import { requireAuth } from '@/lib/auth'

export default async function IndicacoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await requireAuth(['super_admin', 'admin', 'analista'])
  return <AdminLayout profile={profile}>{children}</AdminLayout>
}
