'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Loader2, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Enrollment {
  id: string
  totp: { qr_code: string; secret: string; uri: string }
}

export default function MfaSetupPage() {
  const router = useRouter()
  const initialized = useRef(false)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    async function startEnrollment() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: factors } = await supabase.auth.mfa.listFactors()
      if (factors?.totp.some(factor => factor.status === 'verified')) {
        router.replace('/mfa/verify')
        return
      }

      for (const factor of factors?.all ?? []) {
        if (factor.factor_type === 'totp' && factor.status === 'unverified') {
          await supabase.auth.mfa.unenroll({ factorId: factor.id })
        }
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Eleva — ${user.email ?? 'funcionário'}`,
      })
      if (enrollError) setError(enrollError.message)
      else setEnrollment(data)
      setLoading(false)
    }

    void startEnrollment()
  }, [router])

  async function verify(event: React.FormEvent) {
    event.preventDefault()
    if (!enrollment) return
    setVerifying(true)
    setError('')
    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.id,
      code: code.replace(/\D/g, ''),
    })
    if (verifyError) {
      setError('Código inválido ou expirado. Aguarde o próximo código e tente novamente.')
      setVerifying(false)
      return
    }

    await supabase.rpc('mark_mfa_enrolled')
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1E1A17] p-5">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10"><ShieldCheck className="h-6 w-6 text-primary" /></div>
          <div><p className="text-xs font-bold uppercase tracking-widest text-primary">Proteção obrigatória</p><h1 className="mt-1 text-2xl font-bold text-foreground">Ative a autenticação em duas etapas</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Escaneie o QR code em um aplicativo autenticador e confirme o código de seis dígitos.</p></div>
        </div>

        {loading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Preparando o MFA...</div> : enrollment && (
          <form onSubmit={verify} className="mt-6 space-y-5">
            <div className="mx-auto w-fit rounded-2xl border border-border bg-white p-3">
              {/* O Supabase fornece o QR como data URI SVG para o fator recém-criado. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrollment.totp.qr_code} alt="QR code para configurar o autenticador" className="h-52 w-52" />
            </div>
            <div className="rounded-xl bg-muted p-3">
              <p className="text-[11px] font-semibold text-muted-foreground">Se não conseguir escanear, use esta chave:</p>
              <div className="mt-1 flex items-center justify-between gap-2"><code className="break-all text-xs font-bold text-foreground">{enrollment.totp.secret}</code><button type="button" onClick={() => navigator.clipboard.writeText(enrollment.totp.secret)} aria-label="Copiar chave"><Copy className="h-4 w-4 text-primary" /></button></div>
            </div>
            <label className="block text-sm font-semibold text-foreground">Código do aplicativo
              <input value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="mt-2 block w-full rounded-xl border border-input px-4 py-3 text-center text-xl font-bold tracking-[0.4em] outline-none focus:border-primary" placeholder="000000" required minLength={6} maxLength={6} />
            </label>
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={verifying || code.length !== 6} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{verifying && <Loader2 className="h-4 w-4 animate-spin" />}{verifying ? 'Confirmando...' : 'Ativar e entrar'}</button>
          </form>
        )}
        {!loading && !enrollment && error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </section>
    </main>
  )
}
