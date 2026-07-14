'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'

export function CreateEventModal({ clients, profileId }: { clients: any[]; profileId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    event_date: '',
    event_time: '',
    client_id: '',
    process_id: '',
    visibility: 'admin_only',
    status: 'pending',
  })
  const [processes, setProcesses] = useState<any[]>([])

  useEffect(() => {
    if (!form.client_id) { setProcesses([]); return }
    const supabase = createClient()
    supabase.from('processes').select('id, process_types(name)').eq('client_id', form.client_id)
      .then(({ data }) => setProcesses(data ?? []))
  }, [form.client_id])

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.event_date) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('calendar_events').insert({
      title: form.title,
      description: form.description || null,
      event_date: form.event_date,
      event_time: form.event_time || null,
      client_id: form.client_id || null,
      process_id: form.process_id || null,
      responsible_user_id: profileId,
      visibility: form.visibility as any,
      status: form.status as any,
    })
    setLoading(false)
    setOpen(false)
    setForm({ title: '', description: '', event_date: '', event_time: '', client_id: '', process_id: '', visibility: 'admin_only', status: 'pending' })
    router.refresh()
  }

  const clientOptions = clients.map(c => ({ value: c.id, label: c.name }))
  const processOptions = processes.map(p => ({ value: p.id, label: p.process_types?.name ?? p.id }))

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-4 h-4" /> Novo Evento
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold">Novo Evento</h2>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <Input label="Título *" value={form.title} onChange={e => update('title', e.target.value)} required />
              <Textarea label="Descrição" value={form.description} onChange={e => update('description', e.target.value)} rows={2} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Data *" type="date" value={form.event_date} onChange={e => update('event_date', e.target.value)} required />
                <Input label="Horário" type="time" value={form.event_time} onChange={e => update('event_time', e.target.value)} />
              </div>
              <Select label="Cliente" options={clientOptions} placeholder="Selecione (opcional)" value={form.client_id} onChange={e => update('client_id', e.target.value)} />
              {processes.length > 0 && (
                <Select label="Processo" options={processOptions} placeholder="Selecione" value={form.process_id} onChange={e => update('process_id', e.target.value)} />
              )}
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Visibilidade"
                  options={[{ value: 'admin_only', label: 'Somente equipe' }, { value: 'client_visible', label: 'Visível para cliente' }]}
                  value={form.visibility}
                  onChange={e => update('visibility', e.target.value)}
                />
                <Select
                  label="Status"
                  options={[{ value: 'pending', label: 'Pendente' }, { value: 'in_progress', label: 'Em Andamento' }, { value: 'completed', label: 'Concluído' }]}
                  value={form.status}
                  onChange={e => update('status', e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={loading}>Criar Evento</Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
