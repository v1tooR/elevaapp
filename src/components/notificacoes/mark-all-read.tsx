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
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profileId)
      .eq('is_read', false)
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="dash shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 cursor-pointer"
      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }}
    >
      {loading ? (
        <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
      ) : (
        <CheckCheck className="w-4 h-4" />
      )}
      {loading ? 'Marcando...' : 'Marcar todas como lidas'}
    </button>
  )
}
