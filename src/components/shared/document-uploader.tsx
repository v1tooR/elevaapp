'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Link2, Plus, X, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

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
  { value: 'formulario', label: 'Formulário' },
  { value: 'outros', label: 'Outros' },
]

interface Props {
  processId: string
  clientId: string
  onUploadComplete?: () => void
}

export function DocumentUploader({ processId, clientId, onUploadComplete }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', url: '', type: '' })

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const isValidDriveUrl = (url: string) => {
    try { new URL(url); return true } catch { return false }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.title.trim()) { setError('Informe um nome para o documento.'); return }
    if (!form.url.trim() || !isValidDriveUrl(form.url)) { setError('Informe um link válido.'); return }

    setLoading(true)
    const supabase = createClient()

    const { error: insertErr } = await supabase.from('documents').insert({
      client_id: clientId,
      process_id: processId,
      file_name: form.title.trim(),
      file_url: form.url.trim(),
      storage_path: null,
      document_type: form.type || null,
      status: 'received',
    })

    if (insertErr) { setError(insertErr.message); setLoading(false); return }

    await supabase.from('process_history').insert({
      process_id: processId,
      action_type: 'document_uploaded',
      new_value: form.title.trim(),
      note: `Link adicionado: ${form.title.trim()}`,
    })

    setLoading(false)
    setOpen(false)
    setForm({ title: '', url: '', type: '' })
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
          <Plus className="w-4 h-4" /> Adicionar link do Drive
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
