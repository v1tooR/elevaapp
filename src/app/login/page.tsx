'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, Mail, Lock, ShieldCheck, Clock, Users } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPassword, setShowPw] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('E-mail ou senha incorretos. Verifique suas credenciais.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', data.user.id)
      .single()

    router.push(profile?.role === 'cliente' ? '/minha-area' : '/dashboard')
    router.refresh()
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,400;0,600;0,700;0,800;1,300&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        * { font-family: 'DM Sans', sans-serif; }
        h1, h2, .heading { font-family: 'Raleway', sans-serif; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.06; }
          50%       { opacity: 0.14; }
        }
        .anim-1 { animation: fadeUp 0.5s ease-out 0.05s both; }
        .anim-2 { animation: fadeUp 0.5s ease-out 0.15s both; }
        .anim-3 { animation: fadeUp 0.5s ease-out 0.25s both; }
        .anim-4 { animation: fadeUp 0.5s ease-out 0.35s both; }
        .anim-5 { animation: fadeUp 0.5s ease-out 0.45s both; }
        .fade-in { animation: fadeIn 0.8s ease-out both; }
        .orb { animation: pulse-slow 4s ease-in-out infinite; }
        .input-field {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          color: #fff;
          border-radius: 12px;
          padding: 12px 44px 12px 42px;
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
        .input-field:-webkit-autofill,
        .input-field:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #2a1208 inset !important;
          -webkit-text-fill-color: #fff !important;
          border-color: rgba(201,122,82,0.65) !important;
        }
        .submit-btn {
          width: 100%;
          background: linear-gradient(135deg, #A14F2A, #6B3019);
          color: #fff;
          font-family: 'Raleway', sans-serif;
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
          letter-spacing: 0.01em;
        }
        .submit-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 6px 28px rgba(161,79,42,0.55);
        }
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>

      <div
        className="min-h-screen flex"
        style={{ background: 'linear-gradient(160deg, #1E1A17 0%, #2a1208 50%, #3d1a0a 100%)' }}
      >
        {/* Background glows */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="orb absolute -top-40 -left-40 w-150 h-150 rounded-full"
            style={{ background: 'radial-gradient(circle, #A14F2A, transparent 70%)' }} />
          <div className="orb absolute -bottom-40 -right-40 w-125 h-125 rounded-full"
            style={{ background: 'radial-gradient(circle, #6B3019, transparent 70%)', animationDelay: '2s' }} />
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        </div>

        {/* ── LEFT PANEL (desktop only) ──────────────────────────── */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative">
          <div className="fade-in">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #A14F2A, #6B3019)' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  <line x1="12" y1="12" x2="12" y2="16" />
                  <line x1="10" y1="14" x2="14" y2="14" />
                </svg>
              </div>
              <span className="heading text-white font-bold text-lg tracking-tight">Eleva Isenções</span>
            </div>
          </div>

          <div className="space-y-8">
            <div className="anim-1">
              <h1 className="heading text-4xl xl:text-5xl font-bold text-white leading-tight">
                Gestão de processos<br />
                <span style={{ background: 'linear-gradient(90deg, #C97A52, #F0C8A0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  PCD simplificada
                </span>
              </h1>
              <p className="mt-4 text-base leading-relaxed max-w-sm" style={{ color: 'rgba(201,122,82,0.65)' }}>
                Acompanhe isenções, documentos e processos em tempo real. Tudo que você precisa em um só lugar.
              </p>
            </div>

            <div className="anim-2 space-y-3">
              {[
                { icon: ShieldCheck, color: '#425438', label: 'Dados protegidos e criptografados' },
                { icon: Clock,       color: '#C97A52', label: 'Atualização em tempo real dos processos' },
                { icon: Users,       color: '#A14F2A', label: 'Portal dedicado para clientes e equipe' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: f.color + '20', border: `1px solid ${f.color}35` }}
                  >
                    <f.icon className="w-4 h-4" style={{ color: f.color }} />
                  </div>
                  <span className="text-sm" style={{ color: 'rgba(201,122,82,0.6)' }}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs" style={{ color: 'rgba(201,122,82,0.3)' }}>
            © {new Date().getFullYear()} Eleva Isenções. Todos os direitos reservados.
          </p>
        </div>

        {/* ── RIGHT PANEL / Form ─────────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center p-6 relative">
          <div className="w-full max-w-sm">

            {/* Mobile logo */}
            <div className="lg:hidden text-center mb-8 anim-1">
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
              <p className="text-xs mt-1" style={{ color: 'rgba(201,122,82,0.5)' }}>Sistema de Gestão de Processos PCD</p>
            </div>

            {/* Glass card */}
            <div
              className="anim-2 rounded-2xl p-7"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
              }}
            >
              <div className="mb-6">
                <h2 className="heading text-xl font-bold text-white">Entrar no sistema</h2>
                <p className="text-sm mt-1" style={{ color: 'rgba(201,122,82,0.55)' }}>Acesse sua conta para continuar</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">

                <div className="anim-3 space-y-1.5">
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

                <div className="anim-4 space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(201,122,82,0.6)' }}>Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(201,122,82,0.4)' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="input-field"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                      style={{ color: 'rgba(201,122,82,0.4)' }}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
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

                <div className="anim-5 pt-1">
                  <button type="submit" disabled={loading} className="submit-btn">
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Entrando...</>
                      : 'Entrar'}
                  </button>
                </div>
              </form>
            </div>

            <p className="lg:hidden text-center text-xs mt-6" style={{ color: 'rgba(201,122,82,0.3)' }}>
              © {new Date().getFullYear()} Eleva Isenções. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
