import { createClient } from '@/lib/supabase/server'
import { Settings } from 'lucide-react'
import { ProcessTypeManager } from '@/components/configuracoes/process-type-manager'
import { UserManager } from '@/components/configuracoes/user-manager'

export const metadata = { title: 'Configurações — Eleva Isenções' }

export default async function ConfiguracoesPage() {
  const supabase = await createClient()

  const [{ data: processTypes }, { data: profiles }] = await Promise.all([
    supabase.from('process_types').select('*').neq('slug', 'resumo').order('name'),
    supabase.from('profiles').select('*').order('name'),
  ])

  const pts = processTypes ?? []
  const profs = profiles ?? []
  const activeTypes = pts.filter((p: any) => p.is_active).length
  const totalUsers = profs.length
  const activeUsers = profs.filter((p: any) => p.role !== 'cliente').length

  const chips = [
    { label: 'Tipos de processo', value: String(pts.length),    bg: 'rgba(99,102,241,0.15)',  color: '#a5b4fc' },
    { label: 'Tipos ativos',      value: String(activeTypes),   bg: 'rgba(34,197,94,0.15)',   color: '#86efac' },
    { label: 'Usuários',          value: String(totalUsers),    bg: 'rgba(148,163,184,0.15)', color: '#cbd5e1' },
    { label: 'Staff',             value: String(activeUsers),   bg: 'rgba(245,158,11,0.15)',  color: '#fcd34d' },
  ]

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .anim-1 { animation: slideUp 0.45s cubic-bezier(.22,1,.36,1) both; }
        .anim-2 { animation: slideUp 0.45s cubic-bezier(.22,1,.36,1) 0.08s both; }
      `}</style>

      {/* ── Dark indigo banner ── */}
      <div
        className="anim-1 rounded-2xl overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #1E1A17 0%, #6B3019 55%, #A14F2A 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(ellipse at 80% 50%, #818cf8 0%, transparent 60%)' }}
        />
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)' }}
            >
              <Settings className="w-6 h-6 text-primary-foreground/75" />
            </div>
            <div>
              <h1 className="dash text-2xl font-bold text-white">Configurações</h1>
              <p className="dash text-slate-400 text-sm mt-0.5">Gerenciamento do sistema</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap mt-4">
            {chips.map(chip => (
              <div
                key={chip.label}
                className="dash flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: chip.bg, border: '1px solid rgba(255,255,255,0.08)', color: chip.color }}
              >
                <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{chip.value}</span>
                {chip.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content grid ── */}
      <div className="anim-2 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ProcessTypeManager processTypes={pts} />
        <UserManager profiles={profs} />
      </div>
    </div>
  )
}
