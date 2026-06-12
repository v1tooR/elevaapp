import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { ProcessStatusBadge } from '@/components/shared/status-badge'
import { formatDate, formatCPF, formatPhone } from '@/lib/utils'
import { FolderOpen, FileText, Bell, Phone, Mail, User } from 'lucide-react'
import Link from 'next/link'

export default async function MinhaAreaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('auth_user_id', user!.id).single()

  const { data: client } = await supabase
    .from('clients').select('*').eq('profile_id', profile!.id).single()

  const clientId = client?.id

  const [{ data: processes }, { data: notifications }] = clientId ? await Promise.all([
    supabase.from('processes')
      .select('*, process_types(name, color, slug)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('notifications')
      .select('*')
      .eq('user_id', profile!.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5),
  ]) : [{ data: [] }, { data: [] }]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Olá, {profile?.name?.split(' ')[0]}!</h1>
        <p className="text-slate-500 text-sm mt-1">Bem-vindo(a) à sua área</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <FolderOpen className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{processes?.length ?? 0}</p>
            <p className="text-xs text-slate-500">Processos</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">
              {(processes ?? []).filter((p: any) => p.status === 'concluido').length}
            </p>
            <p className="text-xs text-slate-500">Concluídos</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{notifications?.length ?? 0}</p>
            <p className="text-xs text-slate-500">Notificações</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Processes */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Meus Processos</h2>
              <Link href="/minha-area/processos" className="text-xs text-blue-600 hover:underline">Ver todos</Link>
            </div>
            {!processes || processes.length === 0 ? (
              <div className="p-10 text-center">
                <FolderOpen className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nenhum processo cadastrado ainda</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {processes.map((p: any) => (
                  <Link key={p.id} href={`/minha-area/processos/${p.id}`} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.process_types?.color ?? '#3B82F6' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{p.process_types?.name}</p>
                      {p.protocol && <p className="text-xs text-slate-500">Protocolo: {p.protocol}</p>}
                      <p className="text-xs text-slate-400">{formatDate(p.created_at)}</p>
                    </div>
                    <ProcessStatusBadge status={p.status} />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Notifications */}
          {(notifications?.length ?? 0) > 0 && (
            <Card padding="none">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900 text-sm">Notificações</h2>
                <Link href="/minha-area/notificacoes" className="text-xs text-blue-600 hover:underline">Ver todas</Link>
              </div>
              <div className="divide-y divide-slate-50">
                {notifications!.slice(0, 3).map((n: any) => (
                  <div key={n.id} className="p-3">
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* My data */}
          {client && (
            <Card>
              <h2 className="font-semibold text-slate-800 mb-3 text-sm">Meus Dados</h2>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{client.name}</span>
                </div>
                {client.cpf && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-slate-400 w-4">CPF</span>
                    <span className="text-slate-700">{formatCPF(client.cpf)}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-700">{formatPhone(client.phone)}</span>
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-700">{client.email}</span>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
