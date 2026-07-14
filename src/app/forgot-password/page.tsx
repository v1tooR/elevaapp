'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    })

    if (authError) {
      setError('Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.06; }
          50%       { opacity: 0.14; }
        }
        .anim-1 { animation: fadeUp 0.5s ease-out 0.05s both; }
        .anim-2 { animation: fadeUp 0.5s ease-out 0.15s both; }
        .anim-3 { animation: fadeUp 0.5s ease-out 0.25s both; }
        .orb { animation: pulse-slow 4s ease-in-out infinite; }
        .input-field {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          color: #fff;
          border-radius: 12px;
          padding: 12px 16px 12px 42px;
          font-size: 14px;
          width: 100%;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .input-field::placeholder { color: rgba(255,255,255,0.25); }
        .input-field:focus {
          border-color: rgba(201,122,82,0.65);
          background: rgba(255,255,255,0.1);
          box-shadow: 0 0 0 3px rgba(161,79,42,0.15);
        }
        .submit-btn {
          width: 100%;
          background: linear-gradient(135deg, #A14F2A, #6B3019);
          color: #fff;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 15px;
          padding: 13px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 20px rgba(161,79,42,0.45);
        }
        .submit-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>

      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(160deg, #1E1A17 0%, #2a1208 50%, #3d1a0a 100%)' }}
      >
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="orb absolute -top-40 -left-40 w-150 h-150 rounded-full"
            style={{ background: 'radial-gradient(circle, #A14F2A, transparent 70%)' }} />
          <div className="orb absolute -bottom-40 -right-40 w-125 h-125 rounded-full"
            style={{ background: 'radial-gradient(circle, #6B3019, transparent 70%)', animationDelay: '2s' }} />
        </div>

        <div className="w-full max-w-sm relative">
          <div className="anim-1 text-center mb-6">
            <div
              className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-3"
              style={{ background: 'linear-gradient(135deg, #A14F2A, #6B3019)', boxShadow: '0 8px 24px rgba(161,79,42,0.45)' }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <line x1="12" y1="12" x2="12" y2="16" />
                <line x1="10" y1="14" x2="14" y2="14" />
              </svg>
            </div>
            <h1 className="heading text-xl font-bold text-white">Eleva Isenções</h1>
          </div>

          <div
            className="anim-2 rounded-2xl p-7"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
            }}
          >
            {sent ? (
              <div className="text-center space-y-3 py-2">
                <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: '#4ade80' }} />
                <h2 className="heading text-lg font-bold text-white">E-mail enviado!</h2>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(201,122,82,0.65)' }}>
                  Verifique sua caixa de entrada em <strong className="text-white">{email}</strong> e clique no link para redefinir sua senha.
                </p>
                <p className="text-xs mt-2" style={{ color: 'rgba(201,122,82,0.4)' }}>
                  Não recebeu? Verifique o spam ou tente novamente.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="heading text-xl font-bold text-white">Redefinir senha</h2>
                  <p className="text-sm mt-1" style={{ color: 'rgba(201,122,82,0.55)' }}>
                    Informe seu e-mail para receber o link de redefinição
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(201,122,82,0.6)' }}>E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(201,122,82,0.4)' }} />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        required
                        autoComplete="email"
                        className="input-field"
                      />
                    </div>
                  </div>

                  {error && (
                    <div
                      className="flex items-start gap-2.5 rounded-xl px-3.5 py-3"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                      <p className="text-sm text-red-300 leading-snug">{error}</p>
                    </div>
                  )}

                  <div className="pt-1">
                    <button type="submit" disabled={loading} className="submit-btn">
                      {loading
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                        : 'Enviar link de redefinição'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          <div className="anim-3 mt-5 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm transition-colors cursor-pointer"
              style={{ color: 'rgba(201,122,82,0.55)' }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
