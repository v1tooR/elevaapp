'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createCnhProcessStages } from '@/lib/cnh-stages'
import { ListChecks, Loader2 } from 'lucide-react'
import type { DisabilityType } from '@/types/database'

interface Props {
  processId: string
  clientId: string
  disability?: string
}

export function InitCnhStagesButton({ processId, clientId, disability }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleInit = async () => {
    setLoading(true)
    setError('')
    const supabase = createClient()

    let disabilityType = disability

    // If disability not passed, fetch from client record
    if (!disabilityType) {
      const { data: client } = await supabase
        .from('clients')
        .select('disability_type')
        .eq('id', clientId)
        .single()
      disabilityType = client?.disability_type ?? ''
    }

    if (!disabilityType) {
      setError('Tipo de deficiência não cadastrado no cliente. Atualize o cadastro antes de inicializar as etapas.')
      setLoading(false)
      return
    }

    try {
      await createCnhProcessStages(supabase, processId, disabilityType as DisabilityType)
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? 'Erro ao criar etapas')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <ListChecks className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800">Etapas não inicializadas</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Este processo foi criado antes do sistema de etapas. Clique em inicializar para criar as etapas automaticamente com base na deficiência do cliente.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
      )}

      <button
        type="button"
        onClick={handleInit}
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg, #A14F2A, #C97A52)' }}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ListChecks className="w-4 h-4" />
        )}
        {loading ? 'Criando etapas...' : 'Inicializar etapas CNH'}
      </button>
    </div>
  )
}
