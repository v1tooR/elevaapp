'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Check, X, Edit2 } from 'lucide-react'

export function ProcessTypeManager({ processTypes }: { processTypes: any[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const toggleActive = async (id: string, current: boolean) => {
    const supabase = createClient()
    await supabase.from('process_types').update({ is_active: !current }).eq('id', id)
    router.refresh()
  }

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return
    const supabase = createClient()
    await supabase.from('process_types').update({ name: editName }).eq('id', id)
    setEditingId(null)
    router.refresh()
  }

  return (
    <Card padding="none">
      <div className="divide-y divide-slate-100">
        {processTypes.map(pt => (
          <div key={pt.id} className="flex items-center gap-3 p-4">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: pt.color }} />
            <div className="flex-1 min-w-0">
              {editingId === pt.id ? (
                <div className="flex items-center gap-2">
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none"
                    autoFocus
                  />
                  <button onClick={() => saveEdit(pt.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-50 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${pt.is_active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                    {pt.name}
                  </span>
                  <button
                    onClick={() => { setEditingId(pt.id); setEditName(pt.name) }}
                    className="p-0.5 text-slate-400 hover:text-slate-600"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-400">{pt.slug}</p>
            </div>
            <button
              onClick={() => toggleActive(pt.id, pt.is_active)}
              className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                pt.is_active
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {pt.is_active ? 'Ativo' : 'Inativo'}
            </button>
          </div>
        ))}
      </div>
    </Card>
  )
}
