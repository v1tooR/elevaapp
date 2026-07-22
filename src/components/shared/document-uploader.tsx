'use client'
import { useState } from 'react'
import { Link2, Plus, X, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { ProcessStage } from '@/types/database'
import { isAllowedDocumentUrl } from '@/lib/document-security'

const DOCUMENT_TYPES = [
  { value: 'laudo', label: 'Laudo Médico' },
  { value: 'rg', label: 'RG / CNH' },
  { value: 'cpf', label: 'CPF' },
  { value: 'residencia', label: 'Comprovante de Residência' },
  { value: 'nota_fiscal', label: 'Nota Fiscal' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'procuracao', label: 'Procuração' },
  { value: 'certidao', label: 'Certidão' },
  { value: 'protocolo', label: 'Protocolo / Despacho' },
  { value: 'laudo_imesc', label: 'Laudo IMESC' },
  { value: 'protocolo_sivei', label: 'Protocolo SIVEI' },
  { value: 'decisao_sefaz', label: 'Decisão da SEFAZ' },
  { value: 'recurso_ipva', label: 'Recurso de IPVA' },
  { value: 'ato_dispensa', label: 'Ato de dispensa/reaproveitamento' },
  { value: 'formulario', label: 'Formulário' },
  { value: 'outros', label: 'Outros' },
]

interface Props {
  processId: string
  clientId: string
  stages?: ProcessStage[]
  portalMode?: boolean
  onUploadComplete?: () => void
}

export function DocumentUploader({ processId, stages = [], portalMode = false, onUploadComplete }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', url: '', type: '', stageId: '' })
  const [clientVisible, setClientVisible] = useState(false)
  const [requested, setRequested] = useState(false)

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.title.trim()) { setError('Informe um nome para o documento.'); return }
    if (!form.url.trim() || !isAllowedDocumentUrl(form.url)) { setError('Informe um link HTTPS válido do Google Drive.'); return }

    setLoading(true)
    const response = await fetch(`/api/processos/${processId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title.trim(),
        url: form.url.trim(),
        type: form.type || null,
        stageId: form.stageId || null,
        visibility: portalMode || clientVisible ? 'client_visible' : 'admin_only',
        requested: !portalMode && requested,
      }),
    })
    const result = await response.json()
    if (!response.ok) { setError(result.error ?? 'Não foi possível salvar o documento.'); setLoading(false); return }

    setLoading(false)
    setOpen(false)
    setForm({ title: '', url: '', type: '', stageId: '' })
    setClientVisible(false)
    setRequested(false)
    onUploadComplete?.()
    router.refresh()
  }

  return (
    <div className="p-4 border-b border-slate-100">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
        >
          <Plus className="w-4 h-4" /> {portalMode ? 'Enviar documento pelo Drive' : 'Adicionar link do Drive'}
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-blue-500" /> Novo link de documento
            </span>
            <button type="button" onClick={() => { setOpen(false); setError('') }} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <Input
            label="Nome do documento *"
            placeholder="ex: Laudo médico atualizado"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            required
          />
          <Input
            label="Link do Google Drive *"
            placeholder="https://drive.google.com/..."
            value={form.url}
            onChange={e => set('url', e.target.value)}
            type="url"
            required
          />
          <Select
            label="Tipo de documento"
            options={DOCUMENT_TYPES}
            placeholder="Selecione (opcional)"
            value={form.type}
            onChange={e => set('type', e.target.value)}
          />
          {stages.length > 0 && (
            <Select
              label="Etapa relacionada"
              options={[...stages]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(stage => ({ value: stage.id, label: stage.label }))}
              placeholder="Selecione (opcional)"
              value={form.stageId}
              onChange={e => set('stageId', e.target.value)}
            />
          )}
          {!portalMode && (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <input type="checkbox" checked={clientVisible} onChange={event => setClientVisible(event.target.checked)} className="mt-0.5 h-4 w-4" />
                <span><strong className="block font-medium">Visível ao cliente</strong>O cliente poderá consultar.</span>
              </label>
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <input type="checkbox" checked={requested} onChange={event => setRequested(event.target.checked)} className="mt-0.5 h-4 w-4" />
                <span><strong className="block font-medium">Documento solicitado</strong>Inclui na fila de revisão.</span>
              </label>
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={loading}>Salvar link</Button>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); setError('') }}>Cancelar</Button>
          </div>
        </form>
      )}
    </div>
  )
}

// Componente auxiliar para exibir o link com ícone — usado na listagem
export function DriveLink({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-blue-600 hover:underline hover:text-blue-700 transition-colors truncate max-w-55"
      title={label}
    >
      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </a>
  )
}
