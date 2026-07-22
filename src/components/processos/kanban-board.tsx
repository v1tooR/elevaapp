'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, GripVertical } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const COLUMNS = [
  { key: 'aberto',                 label: 'Aberto',             color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
  { key: 'em_andamento',           label: 'Em Andamento',       color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', text: '#B45309' },
  { key: 'aguardando_documentos',  label: 'Aguard. Documentos', color: '#F97316', bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C' },
  { key: 'em_analise',             label: 'Em Análise',         color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9' },
  { key: 'aguardando_orgao',       label: 'Aguard. Órgão',      color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE', text: '#4338CA' },
  { key: 'concluido',              label: 'Concluído',          color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46' },
]

interface Process {
  id: string
  status: string
  protocol: string | null
  created_at: string
  clients: { id: string; name: string } | null
}

interface Props {
  initialProcesses: Process[]
}

export function KanbanBoard({ initialProcesses }: Props) {
  const [processes, setProcesses] = useState<Process[]>(initialProcesses)
  const [draggingId, setDraggingId]   = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [updating, setUpdating]       = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)

  const byStatus = (s: string) => processes.filter(p => p.status === s)

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id)
    e.dataTransfer.setData('processId', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, col: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(col)
  }

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('processId')
    setDragOverCol(null)
    setDraggingId(null)

    const proc = processes.find(p => p.id === id)
    if (!proc || proc.status === newStatus) return

    const oldStatus = proc.status
    setProcesses(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p))
    setUpdating(id)
    setError(null)

    const response = await fetch(`/api/processos/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      setProcesses(prev => prev.map(p => p.id === id ? { ...p, status: oldStatus } : p))
      setError(result.error ?? 'Não foi possível mover o processo.')
    }
    setUpdating(null)
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2.5 rounded-xl dash">
          {error}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 480 }}>
        {COLUMNS.map(col => {
          const cards  = byStatus(col.key)
          const isOver = dragOverCol === col.key

          return (
            <div
              key={col.key}
              className="flex-none flex flex-col gap-2"
              style={{ width: 224 }}
              onDragOver={e => handleDragOver(e, col.key)}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={e => handleDrop(e, col.key)}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-3 py-2 rounded-xl shrink-0"
                style={{ background: col.bg, border: `1px solid ${col.border}` }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: col.color }} />
                  <span className="text-xs font-bold dash leading-none" style={{ color: col.text }}>
                    {col.label}
                  </span>
                </div>
                <span
                  className="text-[11px] font-bold px-1.5 py-0.5 rounded-md leading-none"
                  style={{ background: col.border, color: col.text }}
                >
                  {cards.length}
                </span>
              </div>

              {/* Drop zone */}
              <div
                className="flex-1 flex flex-col gap-2 p-1.5 rounded-xl transition-all"
                style={{
                  minHeight: 160,
                  background: isOver ? `${col.color}0D` : 'transparent',
                  outline: isOver ? `2px dashed ${col.color}60` : '2px dashed transparent',
                  outlineOffset: '-2px',
                }}
              >
                {cards.map(p => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={e => handleDragStart(e, p.id)}
                    className="bg-white rounded-xl p-3 select-none transition-all"
                    style={{
                      border: `1px solid ${updating === p.id ? col.color : '#E2E8F0'}`,
                      boxShadow: updating === p.id
                        ? `0 0 0 3px ${col.color}20`
                        : '0 1px 3px rgba(0,0,0,0.06)',
                      opacity:  draggingId === p.id ? 0.4 : 1,
                      cursor:   draggingId === p.id ? 'grabbing' : 'grab',
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-3.5 h-3.5 text-slate-200 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="dash text-sm font-semibold text-slate-800 truncate leading-snug">
                          {p.clients?.name ?? '—'}
                        </p>
                        {p.protocol && (
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md mt-1 inline-block">
                            {p.protocol}
                          </span>
                        )}
                        <p className="text-[11px] text-slate-400 dash mt-1.5">{formatDate(p.created_at)}</p>
                      </div>
                      <Link
                        href={`/processos/${p.id}`}
                        onClick={e => e.stopPropagation()}
                        className="w-6 h-6 rounded-lg bg-slate-50 hover:bg-blue-50 flex items-center justify-center transition-colors shrink-0 mt-0.5"
                      >
                        <ArrowUpRight className="w-3 h-3 text-slate-300 hover:text-blue-500 transition-colors" />
                      </Link>
                    </div>
                  </div>
                ))}

                {cards.length === 0 && (
                  <div
                    className="flex-1 flex items-center justify-center rounded-lg"
                    style={{
                      minHeight: 80,
                      border: `1.5px dashed ${isOver ? col.color : col.border}`,
                      opacity: isOver ? 1 : 0.6,
                    }}
                  >
                    <p className="text-[11px] dash" style={{ color: isOver ? col.color : '#CBD5E1' }}>
                      {isOver ? 'Soltar aqui' : 'Arraste aqui'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
