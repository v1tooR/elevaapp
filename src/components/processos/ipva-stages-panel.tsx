'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, Loader2, RefreshCw, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import type { Document, LegalRuleVersion, ProcessStage } from '@/types/database'

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  aprovado: 'Aprovado',
  reprovado: 'Indeferido',
  nao_aplicavel: 'Não aplicável',
}

const STATUS_STYLES: Record<string, string> = {
  pendente: 'bg-slate-100 text-slate-600 border-slate-200',
  em_andamento: 'bg-amber-50 text-amber-700 border-amber-200',
  concluido: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  aprovado: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reprovado: 'bg-red-50 text-red-700 border-red-200',
  nao_aplicavel: 'bg-slate-50 text-slate-400 border-slate-100',
}

interface Props {
  processId: string
  stages: ProcessStage[]
  documents: Document[]
  legalRules?: LegalRuleVersion[]
}

export function IpvaStagesPanel({ processId, stages, documents, legalRules = [] }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const syncWorkflow = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/processos/${processId}/workflow`, { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível sincronizar o workflow.')
      router.refresh()
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Não foi possível sincronizar o workflow.')
    } finally {
      setLoading(false)
    }
  }

  const sortedStages = [...stages].sort((a, b) => a.sort_order - b.sort_order)
  const completed = sortedStages.filter(stage => ['concluido', 'aprovado', 'nao_aplicavel'].includes(stage.status)).length
  const progress = sortedStages.length > 0 ? Math.round((completed / sortedStages.length) * 100) : 0

  if (sortedStages.length === 0) {
    return (
      <div className="space-y-3 p-5">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Workflow IMESC/IPVA ainda não inicializado</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">A inicialização cria as etapas formais e sincroniza o estado atual sem duplicá-las.</p>
          </div>
        </div>
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <Button onClick={syncWorkflow} loading={loading} className="w-full">Inicializar workflow IPVA</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-40 flex-1">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">Progresso operacional</span>
            <span className="font-bold text-slate-900">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={syncWorkflow} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sincronizar
        </Button>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="space-y-2">
        {sortedStages.map((stage, index) => {
          const linkedDocuments = documents.filter(document => document.process_stage_id === stage.id)
          const isDone = ['concluido', 'aprovado', 'nao_aplicavel'].includes(stage.status)
          return (
            <div key={stage.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isDone ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-bold">{index + 1}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{stage.label}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[stage.status] ?? STATUS_STYLES.pendente}`}>
                      {STATUS_LABELS[stage.status] ?? stage.status}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    {stage.scheduled_date && <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> Agendado: {formatDate(stage.scheduled_date)}</span>}
                    {stage.due_date && <span className="inline-flex items-center gap-1 font-semibold text-red-600"><AlertTriangle className="h-3 w-3" /> Prazo: {formatDate(stage.due_date)}</span>}
                  </div>
                  {linkedDocuments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {linkedDocuments.map(document => (
                        <a key={document.id} href={document.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-100">
                          <ExternalLink className="h-3 w-3" /> {document.file_name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {legalRules.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
            <Scale className="h-3.5 w-3.5" /> Regras oficiais ativas ({legalRules.length})
          </summary>
          <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
            {legalRules.map(rule => (
              <a key={rule.id} href={rule.source_url} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-700 hover:underline">
                {rule.title} · {rule.version}
              </a>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

