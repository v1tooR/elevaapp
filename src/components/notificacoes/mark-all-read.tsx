'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCheck } from 'lucide-react'

export function MarkAllReadButton({ profileId }: { profileId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profileId).eq('is_read', false)
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline disabled:opacity-50"
    >
      <CheckCheck className="w-4 h-4" />
      Marcar todas como lidas
    </button>
  )
}
