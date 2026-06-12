import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Settings, Users, Tag } from 'lucide-react'
import { ProcessTypeManager } from '@/components/configuracoes/process-type-manager'
import { UserManager } from '@/components/configuracoes/user-manager'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()

  const [{ data: processTypes }, { data: profiles }] = await Promise.all([
    supabase.from('process_types').select('*').order('name'),
    supabase.from('profiles').select('*').order('name'),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-slate-500 text-sm mt-1">Gerenciamento do sistema</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" />
            Tipos de Processo
          </h2>
          <ProcessTypeManager processTypes={processTypes ?? []} />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Usuários
          </h2>
          <UserManager profiles={profiles ?? []} />
        </div>
      </div>
    </div>
  )
}
