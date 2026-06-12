import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { ProcessStatusBadge } from '@/components/shared/status-badge'
import { formatDate } from '@/lib/utils'
import { FolderOpen } from 'lucide-react'
import Link from 'next/link'

export default async function ClienteProcessosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user!.id).single()
  const { data: client } = await supabase.from('clients').select('id').eq('profile_id', profile!.id).single()

  const { data: processes } = client ? await supabase
    .from('processes')
    .select('*, process_types(name, color)')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false }) : { data: [] }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Meus Processos</h1>
      <Card padding="none">
        {!processes || processes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="w-12 h-12 text-slate-200 mb-3" />
            <p className="text-slate-400">Nenhum processo cadastrado</p>
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
  )
}
