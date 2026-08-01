'use client'

import { useState } from 'react'
import { CarFront, Loader2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { ClientVehicle, VehicleCondition } from '@/types/database'

const CONDITION_LABEL: Record<VehicleCondition, string> = {
  zero_km: 'Zero-quilometro',
  usado: 'Usado',
}

const EMPTY_FORM = {
  description: '',
  vehicleCondition: 'zero_km' as VehicleCondition,
  plate: '',
  renavam: '',
  chassis: '',
  brand: '',
  model: '',
  modelYear: '',
}

export function VehicleManager({
  clientId,
  initialVehicles,
}: {
  clientId: string
  initialVehicles: ClientVehicle[]
}) {
  const [vehicles, setVehicles] = useState(initialVehicles)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const response = await fetch(`/api/clientes/${clientId}/veiculos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        modelYear: form.modelYear ? Number(form.modelYear) : null,
      }),
    })
    const result = await response.json().catch(() => ({}))

    if (!response.ok || !result.vehicle) {
      setError(result.error ?? 'Nao foi possivel cadastrar o veiculo.')
      setLoading(false)
      return
    }

    setVehicles(current => [result.vehicle as ClientVehicle, ...current])
    setForm(EMPTY_FORM)
    setShowForm(false)
    setLoading(false)
  }

  return (
    <div className="anim anim-2 overflow-hidden rounded-2xl bg-white" style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50">
            <CarFront className="h-4 w-4 text-cyan-700" />
          </div>
          <div>
            <h2 className="dash font-bold text-slate-900">Veiculos do cliente</h2>
            <p className="dash mt-0.5 text-xs text-slate-500">Identificacao compartilhada por IPI, ICMS e IPVA.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(current => !current); setError('') }}
          className="dash inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-800"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? 'Fechar' : 'Novo veiculo'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="space-y-4 border-b border-slate-100 bg-slate-50/60 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Condicao do veiculo *"
              options={[
                { value: 'zero_km', label: 'Zero-quilometro' },
                { value: 'usado', label: 'Usado' },
              ]}
              value={form.vehicleCondition}
              onChange={event => setForm(current => ({ ...current, vehicleCondition: event.target.value as VehicleCondition }))}
            />
            <Input label="Descricao" placeholder="Ex.: SUV a escolher" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} />
            <Input label="Marca" value={form.brand} onChange={event => setForm(current => ({ ...current, brand: event.target.value }))} />
            <Input label="Modelo" value={form.model} onChange={event => setForm(current => ({ ...current, model: event.target.value }))} />
            <Input label="Placa" value={form.plate} onChange={event => setForm(current => ({ ...current, plate: event.target.value.toUpperCase() }))} />
            <Input label="RENAVAM" value={form.renavam} onChange={event => setForm(current => ({ ...current, renavam: event.target.value }))} />
            <Input label="Chassi" value={form.chassis} onChange={event => setForm(current => ({ ...current, chassis: event.target.value.toUpperCase() }))} />
            <Input label="Ano/modelo" type="number" min="1900" max="2200" value={form.modelYear} onChange={event => setForm(current => ({ ...current, modelYear: event.target.value }))} />
          </div>
          <p className="dash text-[11px] text-slate-500">Se os dados ainda nao estiverem disponiveis, informe apenas uma descricao como “veiculo a escolher”.</p>
          {error && <p className="dash rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar veiculo
          </Button>
        </form>
      )}

      {vehicles.length === 0 ? (
        <div className="p-8 text-center">
          <p className="dash text-sm text-slate-500">Nenhum veiculo identificado.</p>
          <p className="dash mt-1 text-xs text-slate-400">O cadastro pode comecar somente com uma descricao provisoria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          {vehicles.map(vehicle => (
            <div key={vehicle.id} className="rounded-xl border border-slate-200 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="dash truncate text-sm font-bold text-slate-900">
                    {[vehicle.brand, vehicle.model].filter(Boolean).join(' ') || vehicle.description || vehicle.plate || 'Veiculo'}
                  </p>
                  <p className="dash mt-0.5 text-[11px] text-slate-500">
                    {[vehicle.plate, vehicle.renavam ? `RENAVAM ${vehicle.renavam}` : null].filter(Boolean).join(' · ') || 'Identificacao em andamento'}
                  </p>
                </div>
                <span className="dash shrink-0 rounded-full border border-cyan-100 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                  {CONDITION_LABEL[vehicle.vehicle_condition]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
