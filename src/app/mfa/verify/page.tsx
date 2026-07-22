'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function MfaVerifyPage() {
  const router = useRouter()
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadFactor() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assurance?.currentLevel === 'aal2') {
        router.replace('/dashboard')
        return
      }
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const factor = factors?.totp.find(item => item.status === 'verified')
      if (!factor) {
        router.replace('/mfa/setup')
        return
      }
      setFactorId(factor.id)
      setLoading(false)
    }
    void loadFactor()
  }, [router])

  async function verify(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    if (verifyError) {
      setError('Código inválido ou expirado. Tente novamente com o código atual.')
      setLoading(false)
      return
    }
    await supabase.rpc('mark_mfa_enrolled')
    router.replace('/dashboard')
    router.refresh()
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1E1A17] p-5">
      <section className="w-full max-w-sm rounded-3xl border border-white/10 bg-white p-7 shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"><ShieldCheck className="h-7 w-7 text-primary" /></div>
        <h1 className="mt-5 text-center text-2xl font-bold text-foreground">Confirme seu acesso</h1>
        <p className="mt-2 text-center text-sm leading-6 text-muted-foreground">Digite o código atual do seu aplicativo autenticador.</p>
        <form onSubmit={verify} className="mt-6 space-y-4">
          <input value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="block w-full rounded-xl border border-input px-4 py-3 text-center text-2xl font-bold tracking-[0.45em] outline-none focus:border-primary" placeholder="000000" required minLength={6} maxLength={6} autoFocus />
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={loading || !factorId || code.length !== 6} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? 'Verificando...' : 'Confirmar e entrar'}</button>
        </form>
        <button type="button" onClick={signOut} className="mt-4 w-full text-center text-xs font-semibold text-muted-foreground hover:text-primary">Entrar com outra conta</button>
      </section>
    </main>
  )
}
