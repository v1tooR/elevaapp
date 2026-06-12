'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, Loader2, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DocumentUploaderProps {
  processId: string
  clientId: string
  onUploadComplete?: () => void
}

export function DocumentUploader({ processId, clientId, onUploadComplete }: DocumentUploaderProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setError('')
    setSuccess(false)
    const supabase = createClient()

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${clientId}/${processId}/${Date.now()}-${file.name}`

      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(path, file, { upsert: false })

      if (uploadErr) {
        setError('Erro ao enviar arquivo: ' + uploadErr.message)
        setUploading(false)
        return
      }

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)

      await supabase.from('documents').insert({
        client_id: clientId,
        process_id: processId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        storage_path: path,
        file_size: file.size,
        mime_type: file.type,
        status: 'received',
      })

      await supabase.from('process_history').insert({
        process_id: processId,
        action_type: 'document_uploaded',
        new_value: file.name,
        note: `Documento enviado: ${file.name}`,
      })
    }

    setUploading(false)
    setSuccess(true)
    if (inputRef.current) inputRef.current.value = ''
    onUploadComplete?.()
    router.refresh()

    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <div className="p-4 border-b border-slate-100">
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        id={`upload-${processId}`}
      />
      <label
        htmlFor={`upload-${processId}`}
        className="flex items-center gap-2 cursor-pointer w-fit px-4 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
      >
        {uploading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
        ) : success ? (
          <><CheckCircle className="w-4 h-4 text-green-500" /> Enviado!</>
        ) : (
          <><Upload className="w-4 h-4" /> Enviar documentos</>
        )}
      </label>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
