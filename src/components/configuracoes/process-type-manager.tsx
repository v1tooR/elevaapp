'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, X, Edit2, Tag } from 'lucide-react'

export function ProcessTypeManager({ processTypes }: { processTypes: any[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const toggleActive = async (id: string, current: boolean) => {
    setTogglingId(id)
    const supabase = createClient()
    await supabase.from('process_types').update({ is_active: !current }).eq('id', id)
    setTogglingId(null)
    router.refresh()
  }

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return
    setSavingId(id)
    const supabase = createClient()
    await supabase.from('process_types').update({ name: editName }).eq('id', id)
    setEditingId(null)
    setSavingId(null)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <Tag className="w-4 h-4 text-indigo-500" />
        </div>
        <div>
          <h2 className="dash text-base font-bold text-slate-800">Tipos de Processo</h2>
          <p className="dash text-xs text-slate-400">{processTypes.length} tipos cadastrados</p>
        </div>
      </div>

      {/* List card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {processTypes.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-2 border border-slate-200">
              <Tag className="w-5 h-5 text-slate-300" />
            </div>
            <p className="dash text-sm text-slate-400">Nenhum tipo cadastrado</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {processTypes.map(pt => (
              <div key={pt.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/70 transition-colors group">
                {/* Color dot */}
                <div
                  className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: pt.color ?? '#94a3b8' }}
                />

                {/* Name / edit */}
                <div className="flex-1 min-w-0">
                  {editingId === pt.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(pt.id); if (e.key === 'Escape') setEditingId(null) }}
                        className="dash flex-1 border border-indigo-300 rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300/40 font-medium text-slate-800"
                        autoFocus
                      />
                      <button
                        onClick={() => saveEdit(pt.id)}
                        disabled={!!savingId}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`dash text-sm font-semibold ${pt.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                        {pt.name}
                      </span>
                      <button
                        onClick={() => { setEditingId(pt.id); setEditName(pt.name) }}
                        className="p-1 text-slate-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <p className="dash text-[11px] text-slate-400 font-mono mt-0.5">{pt.slug}</p>
                </div>

                {/* Active toggle */}
                <button
                  onClick={() => toggleActive(pt.id, pt.is_active)}
                  disabled={togglingId === pt.id}
                  className={`dash text-[11px] px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer disabled:opacity-60 ${
                    pt.is_active
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {togglingId === pt.id ? '…' : pt.is_active ? 'Ativo' : 'Inativo'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
