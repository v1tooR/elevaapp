'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, ArrowUpRight, ArrowDownRight, TrendingUp, Wallet,
  Search, X, Pencil, Trash2, RefreshCw, Tag,
  ChevronDown, Upload, FileText, CheckSquare, Square,
  CheckCircle2, Clock, AlertCircle, HandCoins, CalendarDays,
  SlidersHorizontal, RotateCcw,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────

type FinanceStatus     = 'CONFIRMED' | 'PREDICTED' | 'OVERDUE'
type FinanceRecurrence = 'NONE' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL'

interface Category { id: string; name: string; color: string }

interface FinanceEntry {
  id: string
  type: 'INCOME' | 'EXPENSE'
  title: string
  description?: string
  amount: number
  occurred_at: string
  category: Category | null
  process: { id: string; title: string } | null
  client: { id: string; name: string } | null
  status: FinanceStatus
  recurrence: FinanceRecurrence
}

interface FinanceSummary { totalIncome: number; totalExpense: number; balance: number; count: number }

interface MonthStat { month: string; label: string; income: number; expense: number }

interface CategoryBreakdown {
  id: string | null; name: string; color: string | null; total: number; percentage: number
}

interface FinanceStats {
  months: MonthStat[]
  categoryBreakdown: CategoryBreakdown[]
  comparison: { currentIncome: number; currentExpense: number; prevIncome: number; prevExpense: number }
  receivables: { total: number; count: number }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtShort(n: number) {
  if (Math.abs(n) >= 1000) return (n / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'k'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDayHeader(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yest  = new Date(today); yest.setDate(today.getDate() - 1)
  const day   = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (day.getTime() === today.getTime()) return 'Hoje'
  if (day.getTime() === yest.getTime())  return 'Ontem'
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

function dayKey(iso: string) {
  return iso.substring(0, 10)
}

function pctDiff(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

const STATUS_CFG: Record<FinanceStatus, { label: string; cls: string; Icon: React.ElementType }> = {
  CONFIRMED: { label: 'Confirmado', cls: 'bg-green-100 text-green-700',  Icon: CheckCircle2 },
  PREDICTED: { label: 'Previsto',   cls: 'bg-amber-100 text-amber-700',  Icon: Clock },
  OVERDUE:   { label: 'Em atraso',  cls: 'bg-red-100 text-red-600',      Icon: AlertCircle },
}

const RECURRENCE_LABELS: Record<FinanceRecurrence, string> = {
  NONE: 'Sem recorrência', WEEKLY: 'Semanal', MONTHLY: 'Mensal', ANNUAL: 'Anual',
}

const DEFAULT_COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#84CC16']

// ── Charts ────────────────────────────────────────────────────────────────────

function BarChartComp({ months }: { months: MonthStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={months} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="#F1F5F9" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8B6F5E', fontFamily: 'var(--font-dm-sans)' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#C9B8AA', fontFamily: 'var(--font-dm-sans)' }} axisLine={false} tickLine={false} width={36} />
        <Tooltip
          formatter={(v: unknown, name: unknown) => [fmt(v as number), name === 'income' ? 'Receitas' : 'Despesas']}
          contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #E5D9CE', padding: '6px 10px', fontFamily: 'var(--font-dm-sans)' }}
        />
        <Bar dataKey="income"  fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="expense" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function AreaChartComp({ months }: { months: MonthStat[] }) {
  const data = months.reduce<{ label: string; balance: number }[]>((acc, month) => {
    const previousBalance = acc.at(-1)?.balance ?? 0
    return [...acc, { label: month.label, balance: previousBalance + month.income - month.expense }]
  }, [])
  const color = (data[data.length - 1]?.balance ?? 0) >= 0 ? '#6366F1' : '#EF4444'
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="bal-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#F1F5F9" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8B6F5E', fontFamily: 'var(--font-dm-sans)' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: '#C9B8AA', fontFamily: 'var(--font-dm-sans)' }} axisLine={false} tickLine={false} width={36} />
        <Tooltip
          formatter={(v: unknown) => [fmt(v as number), 'Saldo']}
          contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #E5D9CE', padding: '6px 10px', fontFamily: 'var(--font-dm-sans)' }}
        />
        <Area type="monotone" dataKey="balance" stroke={color} strokeWidth={2} fill="url(#bal-grad)"
          dot={{ fill: '#fff', stroke: color, strokeWidth: 2, r: 3 }} activeDot={{ r: 5, fill: color }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, subtitle, onClose, children, wide, gradient = 'linear-gradient(135deg, #6B3019 0%, #A14F2A 100%)' }: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
  gradient?: string
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', h)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', h)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`modal-anim flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[22px] bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl ${wide ? 'sm:max-w-xl' : 'sm:max-w-md'}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Dark gradient header */}
        <div className="flex shrink-0 items-center justify-between px-5 py-4 sm:px-6" style={{ background: gradient }}>
          <div>
            <h3 className="dash text-sm font-bold text-white">{title}</h3>
            {subtitle && <p className="dash text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/10 cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  )
}

// ── EntryFormModal ────────────────────────────────────────────────────────────

interface EntryForm {
  type: 'INCOME' | 'EXPENSE'
  title: string; description: string; amount: string; occurred_at: string
  category_id: string; status: FinanceStatus; recurrence: FinanceRecurrence
}

function EntryFormModal({ editing, categories, onClose, onSaved }: {
  editing: FinanceEntry | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const today = new Date().toISOString().substring(0, 10)
  const [form, setForm] = useState<EntryForm>(() => editing ? {
    type: editing.type,
    title: editing.title,
    description: editing.description ?? '',
    amount: String(editing.amount),
    occurred_at: editing.occurred_at.substring(0, 10),
    category_id: editing.category?.id ?? '',
    status: editing.status,
    recurrence: editing.recurrence,
  } : { type: 'EXPENSE', title: '', description: '', amount: '', occurred_at: today, category_id: '', status: 'CONFIRMED', recurrence: 'NONE' })

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!form.title.trim() || !form.amount || !form.occurred_at) {
      setErr('Preencha todos os campos obrigatórios.'); return
    }
    setSaving(true); setErr('')
    try {
      const body = {
        type: form.type, title: form.title.trim(),
        description: form.description || undefined,
        amount: String(form.amount).replace(',', '.'),
        occurred_at: form.occurred_at,
        category_id: form.category_id || undefined,
        status: form.status, recurrence: form.recurrence,
      }
      const url    = editing ? `/api/financeiro/${editing.id}` : '/api/financeiro'
      const method = editing ? 'PUT' : 'POST'
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      if (!r.ok) { setErr(d.error ?? 'Erro ao salvar.'); return }
      onSaved(); onClose()
    } finally { setSaving(false) }
  }

  const gradient = form.type === 'INCOME'
    ? 'linear-gradient(135deg, #052e16 0%, #15803d 100%)'
    : 'linear-gradient(135deg, #450a0a 0%, #b91c1c 100%)'

  const lbl = 'block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 dash'
  const inp = 'dash w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-shadow'

  return (
    <Modal
      title={editing ? 'Editar lançamento' : 'Novo lançamento'}
      subtitle={form.type === 'INCOME' ? 'Registrar entrada de valor' : 'Registrar saída de valor'}
      gradient={gradient}
      onClose={onClose}
      wide
    >
      <form onSubmit={save} className="space-y-4">
        {/* Tipo */}
        <div>
          <label className={lbl}>Tipo *</label>
          <div className="grid grid-cols-2 gap-3">
            {(['INCOME', 'EXPENSE'] as const).map(t => {
              const active = form.type === t
              return (
                <button key={t} type="button" onClick={() => setForm(p => ({ ...p, type: t }))}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                    active ? 'text-white shadow-md' : 'border-2 border-slate-200 text-slate-500 hover:border-slate-300 bg-white'
                  }`}
                  style={active ? {
                    background: t === 'INCOME' ? 'linear-gradient(135deg, #15803d, #22c55e)' : 'linear-gradient(135deg, #b91c1c, #ef4444)',
                    boxShadow: t === 'INCOME' ? '0 4px 12px rgba(34,197,94,0.3)' : '0 4px 12px rgba(239,68,68,0.3)',
                  } : {}}>
                  {t === 'INCOME'
                    ? <><ArrowUpRight className="w-4 h-4" /> Entrada</>
                    : <><ArrowDownRight className="w-4 h-4" /> Saída</>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Título */}
        <div>
          <label className={lbl}>Título *</label>
          <input className={inp} value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Ex: Honorários IPI, Aluguel..." />
        </div>

        {/* Valor + Data */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={lbl}>Valor (R$) *</label>
            <input type="number" step="0.01" min="0.01" className={inp}
              value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0,00" />
          </div>
          <div>
            <label className={lbl}>Data *</label>
            <input type="date" className={inp}
              value={form.occurred_at} onChange={e => setForm(p => ({ ...p, occurred_at: e.target.value }))} />
          </div>
        </div>

        {/* Categoria */}
        <div>
          <label className={lbl}>Categoria</label>
          <div className="relative">
            <select className={`${inp} cursor-pointer`} value={form.category_id}
              onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}>
              <option value="">Sem categoria</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Status + Recorrência */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={lbl}>Status</label>
            <div className="relative">
              <select className={`${inp} cursor-pointer`} value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as FinanceStatus }))}>
                <option value="CONFIRMED">Confirmado</option>
                <option value="PREDICTED">Previsto</option>
                <option value="OVERDUE">Em atraso</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className={lbl}>Recorrência</label>
            <div className="relative">
              <select className={`${inp} cursor-pointer`} value={form.recurrence}
                onChange={e => setForm(p => ({ ...p, recurrence: e.target.value as FinanceRecurrence }))}>
                <option value="NONE">Sem recorrência</option>
                <option value="WEEKLY">Semanal</option>
                <option value="MONTHLY">Mensal</option>
                <option value="ANNUAL">Anual</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label className={lbl}>Descrição</label>
          <textarea rows={2} className={`${inp} resize-none`}
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Observação opcional..." />
        </div>

        {err && <p className="dash text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</p>}

        <div className="grid grid-cols-2 gap-3 pt-1 sm:flex sm:justify-end">
          <button type="button" onClick={onClose}
            className="dash px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="dash px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-60 cursor-pointer"
            style={{
              background: form.type === 'INCOME' ? 'linear-gradient(135deg, #15803d, #22c55e)' : 'linear-gradient(135deg, #b91c1c, #ef4444)',
              boxShadow: saving ? 'none' : form.type === 'INCOME' ? '0 4px 12px rgba(34,197,94,0.3)' : '0 4px 12px rgba(239,68,68,0.3)',
            }}>
            {saving
              ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Salvando...</span>
              : editing ? 'Salvar' : 'Registrar'
            }
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── EntryDetailModal ──────────────────────────────────────────────────────────

function EntryDetailModal({ entry, onClose, onEdit, onDelete }: {
  entry: FinanceEntry; onClose: () => void
  onEdit: (e: FinanceEntry) => void; onDelete: (id: string) => void
}) {
  const isIncome = entry.type === 'INCOME'
  const stCfg    = STATUS_CFG[entry.status]
  const gradient = isIncome
    ? 'linear-gradient(135deg, #052e16 0%, #15803d 100%)'
    : 'linear-gradient(135deg, #450a0a 0%, #b91c1c 100%)'

  return (
    <Modal title={entry.title} subtitle={isIncome ? 'Entrada' : 'Saída'} gradient={gradient} onClose={onClose} wide>
      {/* Amount block */}
      <div className="flex items-center gap-4 mb-5 pb-5 border-b border-slate-100">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={isIncome
            ? { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }
            : { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          {isIncome ? <ArrowUpRight className="w-6 h-6 text-green-600" /> : <ArrowDownRight className="w-6 h-6 text-red-600" />}
        </div>
        <div>
          <p className="dash text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">
            {isIncome ? 'Valor da entrada' : 'Valor da saída'}
          </p>
          <p className={`dash text-2xl font-extrabold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
            {isIncome ? '+' : '-'}{fmt(entry.amount)}
          </p>
        </div>
      </div>

      <div className="space-y-4 mb-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="dash text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Data</p>
            <p className="dash text-sm font-semibold text-slate-700">{fmtDate(entry.occurred_at)}</p>
          </div>
          <div>
            <p className="dash text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Categoria</p>
            {entry.category ? (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.category.color }} />
                <span className="dash text-sm font-semibold text-slate-700">{entry.category.name}</span>
              </div>
            ) : <span className="dash text-sm text-slate-400">Sem categoria</span>}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="dash text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${stCfg.cls}`}>
              <stCfg.Icon className="w-3 h-3" /> {stCfg.label}
            </span>
          </div>
          {entry.recurrence !== 'NONE' && (
            <div>
              <p className="dash text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Recorrência</p>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                <RefreshCw className="w-3 h-3" /> {RECURRENCE_LABELS[entry.recurrence]}
              </span>
            </div>
          )}
        </div>
        {entry.process && (
          <div>
            <p className="dash text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Processo vinculado</p>
            <p className="dash text-sm font-semibold text-blue-600">{entry.process.title || 'Processo #' + entry.process.id.substring(0, 8)}</p>
          </div>
        )}
        {entry.description && (
          <div>
            <p className="dash text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Descrição</p>
            <p className="dash text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2.5 leading-relaxed">{entry.description}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:flex sm:justify-end">
        <button onClick={() => { onDelete(entry.id); onClose() }}
          className="dash flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors cursor-pointer">
          <Trash2 className="w-3.5 h-3.5" /> Excluir
        </button>
        <button onClick={() => { onEdit(entry); onClose() }}
          className="dash flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all cursor-pointer"
          style={{ background: gradient }}>
          <Pencil className="w-3.5 h-3.5" /> Editar
        </button>
      </div>
    </Modal>
  )
}

// ── CategoryManagerModal ──────────────────────────────────────────────────────

function CategoryManagerModal({ categories, onClose, onRefresh }: {
  categories: Category[]; onClose: () => void; onRefresh: () => void
}) {
  const [name, setName]   = useState('')
  const [color, setColor] = useState(DEFAULT_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [err, setErr]     = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const create = async () => {
    if (!name.trim()) { setErr('Nome é obrigatório.'); return }
    setSaving(true); setErr('')
    const r = await fetch('/api/financeiro/categorias', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), color }),
    })
    if (r.ok) { setName(''); onRefresh() } else { const d = await r.json(); setErr(d.error ?? 'Erro.') }
    setSaving(false)
  }

  const remove = async (id: string) => {
    if (!confirm('Excluir esta categoria?')) return
    setDeleting(id)
    await fetch(`/api/financeiro/categorias/${id}`, { method: 'DELETE' })
    setDeleting(null); onRefresh()
  }

  return (
    <Modal title="Categorias financeiras" subtitle="Gerencie as categorias dos lançamentos" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="dash text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Nova categoria</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-2">
            <input
              className="dash flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              value={name} onChange={e => { setName(e.target.value); setErr('') }}
              onKeyDown={e => { if (e.key === 'Enter') create() }}
              placeholder="Nome da categoria" />
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.slice(0, 5).map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="w-5 h-5 rounded-full transition-transform hover:scale-110 cursor-pointer"
                  style={{ background: c, outline: color === c ? `2.5px solid ${c}` : 'none', outlineOffset: 2 }} />
              ))}
            </div>
            <button onClick={create} disabled={saving}
              className="dash rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-700 disabled:opacity-60 whitespace-nowrap cursor-pointer">
              {saving ? '...' : 'Criar'}
            </button>
          </div>
          {err && <p className="dash text-xs text-red-600 mt-2">{err}</p>}
        </div>

        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {categories.length === 0 ? (
            <p className="dash text-center text-sm text-slate-400 py-8">Nenhuma categoria ainda.</p>
          ) : categories.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-xl">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color }} />
              <span className="dash flex-1 text-sm font-semibold text-slate-700">{c.name}</span>
              <button onClick={() => remove(c.id)} disabled={deleting === c.id}
                className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ── OFX Import Modal ──────────────────────────────────────────────────────────

interface OFXTxn { fitid: string; type: 'INCOME' | 'EXPENSE'; amount: number; date: string; description: string }

function OFXImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [step, setStep]     = useState<'upload' | 'preview'>('upload')
  const [txns, setTxns]     = useState<OFXTxn[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [progress, setProgress]   = useState(0)
  const [dragging, setDragging]   = useState(false)
  const [err, setErr]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setErr('')
    const fd = new FormData(); fd.append('file', file)
    const r = await fetch('/api/financeiro/import-ofx', { method: 'POST', body: fd })
    const d = await r.json()
    if (!r.ok) { setErr(d.error || 'Erro ao processar arquivo.'); return }
    const t: OFXTxn[] = d.transactions
    setTxns(t); setSelected(new Set(t.map(x => x.fitid))); setStep('preview')
  }

  const doImport = async () => {
    const toImport = txns.filter(t => selected.has(t.fitid))
    if (!toImport.length) return
    setImporting(true); setProgress(0); setErr('')
    try {
      let done = 0
      for (const t of toImport) {
        const response = await fetch('/api/financeiro', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: t.type, title: t.description.substring(0, 120), amount: t.amount.toFixed(2), occurred_at: t.date, status: 'CONFIRMED', recurrence: 'NONE' }),
        })
        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(data?.error || `Falha ao importar "${t.description}".`)
        }
        done++; setProgress(Math.round((done / toImport.length) * 100))
      }
      onImported(); onClose()
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Não foi possível concluir a importação.')
    } finally {
      setImporting(false)
    }
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  return (
    <Modal
      title="Importar extrato OFX / QFX"
      subtitle="Importe transações do seu banco"
      gradient="linear-gradient(135deg, #6B3019 0%, #A14F2A 100%)"
      onClose={onClose}
      wide
    >
      <input ref={fileRef} type="file" accept=".ofx,.qfx" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />

      {step === 'upload' && (
        <div className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-7 text-center transition-all sm:p-12 ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 bg-muted'}`}>
            <Upload className={`w-9 h-9 mx-auto mb-3 ${dragging ? 'text-blue-500' : 'text-slate-300'}`} />
            <p className="dash text-base font-bold text-slate-700 mb-1">
              {dragging ? 'Solte o arquivo aqui' : 'Arraste ou clique para selecionar'}
            </p>
            <p className="dash text-sm text-slate-400">Suporta arquivos .OFX e .QFX exportados pelo seu banco</p>
          </div>
          {err && <p className="dash text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</p>}
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
            {[
              { label: 'Entradas',     value: fmt(txns.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)),  bg: 'rgba(34,197,94,0.08)',   color: '#16a34a' },
              { label: 'Saídas',       value: fmt(txns.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0)), bg: 'rgba(239,68,68,0.08)',   color: '#dc2626' },
              { label: 'Selecionados', value: `${selected.size}/${txns.length}`,                                             bg: 'rgba(100,116,139,0.08)', color: '#475569' },
            ].map(x => (
              <div key={x.label} className="rounded-xl p-3 text-center" style={{ background: x.bg }}>
                <p className="dash text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: x.color, opacity: 0.7 }}>{x.label}</p>
                <p className="dash text-sm font-bold" style={{ color: x.color }}>{x.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => { if (selected.size === txns.length) setSelected(new Set()); else setSelected(new Set(txns.map(t => t.fitid))) }}
              className="dash flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline cursor-pointer">
              {selected.size === txns.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {selected.size === txns.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
            <button onClick={() => { setStep('upload'); setTxns([]); setSelected(new Set()) }}
              className="dash flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 cursor-pointer">
              <FileText className="w-3.5 h-3.5" /> Trocar arquivo
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            {txns.map(t => {
              const isSel = selected.has(t.fitid)
              return (
                <div key={t.fitid} onClick={() => toggle(t.fitid)}
                  className={`grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 border-b border-slate-100 px-3 py-2.5 transition-colors sm:grid-cols-[auto_auto_1fr_auto] sm:gap-3 sm:px-4 ${isSel ? 'bg-blue-50' : 'opacity-50 hover:opacity-70'}`}>
                  {isSel ? <CheckSquare className="w-4 h-4 text-blue-500 shrink-0" /> : <Square className="w-4 h-4 text-slate-300 shrink-0" />}
                  <span className="dash col-span-2 row-start-2 text-[10px] text-slate-400 whitespace-nowrap sm:col-span-1 sm:row-start-auto sm:w-20 sm:text-xs">
                    {new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </span>
                  <span className="dash min-w-0 truncate text-sm text-slate-700">{t.description}</span>
                  <span className={`dash text-sm font-bold whitespace-nowrap ${t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'INCOME' ? '+' : '-'}{fmt(t.amount)}
                  </span>
                </div>
              )
            })}
          </div>

          {importing && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5 dash">
                <span>Importando...</span><span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #3b82f6, #6366f1)' }} />
              </div>
            </div>
          )}

          {err && (
            <p role="alert" className="dash rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
              {err}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
            <button onClick={onClose} disabled={importing}
              className="dash px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
              Cancelar
            </button>
            <button onClick={doImport} disabled={importing || selected.size === 0}
              className="dash flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              {importing ? 'Importando...' : `Importar ${selected.size} lançamento${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── FinanceModule principal ───────────────────────────────────────────────────

export default function FinanceModule() {
  const [entries, setEntries]       = useState<FinanceEntry[]>([])
  const [summary, setSummary]       = useState<FinanceSummary>({ totalIncome: 0, totalExpense: 0, balance: 0, count: 0 })
  const [stats, setStats]           = useState<FinanceStats | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState('')
  const entriesRequestRef           = useRef(0)

  const [filterMonth, setFilterMonth] = useState<string>(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [filterType, setFilterType]         = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterQ, setFilterQ]               = useState('')

  const [showDetail, setShowDetail]         = useState<FinanceEntry | null>(null)
  const [showForm, setShowForm]             = useState(false)
  const [editing, setEditing]               = useState<FinanceEntry | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [showOFX, setShowOFX]               = useState(false)

  const loadEntries = useCallback(async () => {
    const requestId = ++entriesRequestRef.current
    setLoading(true)
    setLoadError('')
    try {
      const p = new URLSearchParams()
      if (filterType)     p.set('type', filterType)
      if (filterMonth)    p.set('month', filterMonth)
      if (filterCategory) p.set('categoryId', filterCategory)
      if (filterStatus)   p.set('status', filterStatus)
      if (filterQ.trim()) p.set('q', filterQ.trim())
      const r = await fetch(`/api/financeiro?${p}`, { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Não foi possível carregar os lançamentos.')
      if (requestId !== entriesRequestRef.current) return
      setEntries(d.entries)
      setSummary(d.summary)
    } catch (error) {
      if (requestId !== entriesRequestRef.current) return
      setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar os lançamentos.')
    } finally {
      if (requestId === entriesRequestRef.current) setLoading(false)
    }
  }, [filterType, filterMonth, filterCategory, filterStatus, filterQ])

  const loadStats = useCallback(async () => {
    const r = await fetch(`/api/financeiro/stats?month=${filterMonth}`)
    if (r.ok) setStats(await r.json())
  }, [filterMonth])

  const loadCategories = useCallback(async () => {
    const r = await fetch('/api/financeiro/categorias')
    if (r.ok) { const d = await r.json(); setCategories(d.categories) }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadEntries() }, filterQ.trim() ? 300 : 0)
    return () => window.clearTimeout(timeout)
  }, [loadEntries, filterQ])

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadStats() }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadStats])

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadCategories() }, 0)
    return () => window.clearTimeout(timeout)
  }, [loadCategories])

  const reload = () => { loadEntries(); loadStats() }

  const remove = async (id: string) => {
    if (!confirm('Excluir este lançamento?')) return
    await fetch(`/api/financeiro/${id}`, { method: 'DELETE' })
    reload()
  }

  const openEdit = (e: FinanceEntry) => { setEditing(e); setShowForm(true) }

  // Group entries by day
  const grouped: { key: string; label: string; entries: FinanceEntry[] }[] = []
  for (const e of entries) {
    const k = dayKey(e.occurred_at)
    const last = grouped[grouped.length - 1]
    if (last && last.key === k) last.entries.push(e)
    else grouped.push({ key: k, label: fmtDayHeader(e.occurred_at), entries: [e] })
  }

  const cmp         = stats?.comparison
  const incomeDiff  = cmp ? pctDiff(cmp.currentIncome,  cmp.prevIncome)  : 0
  const expenseDiff = cmp ? pctDiff(cmp.currentExpense, cmp.prevExpense) : 0
  const selectedMonthLabel = filterMonth
    ? new Date(`${filterMonth}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : 'Todos os períodos'
  const activeFilterCount = [filterType, filterCategory, filterStatus, filterQ.trim()].filter(Boolean).length
  const clearFilters = () => {
    setFilterType('')
    setFilterCategory('')
    setFilterStatus('')
    setFilterQ('')
  }

  const selCls = 'dash h-10 min-w-0 rounded-xl border border-border bg-white px-3 text-sm text-slate-700 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 cursor-pointer'

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes modalIn { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        .modal-anim { animation: modalIn 0.25s cubic-bezier(.22,1,.36,1) both; }
      `}</style>

      {/* Modals */}
      {showDetail && (
        <EntryDetailModal entry={showDetail} onClose={() => setShowDetail(null)}
          onEdit={e => { setShowDetail(null); openEdit(e) }}
          onDelete={id => { remove(id); setShowDetail(null) }} />
      )}
      {showForm && (
        <EntryFormModal editing={editing} categories={categories}
          onClose={() => { setShowForm(false); setEditing(null) }} onSaved={reload} />
      )}
      {showCategories && (
        <CategoryManagerModal categories={categories} onClose={() => setShowCategories(false)} onRefresh={loadCategories} />
      )}
      {showOFX && (
        <OFXImportModal onClose={() => setShowOFX(false)} onImported={() => { setFilterMonth(''); reload() }} />
      )}

      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/8 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="dash text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">Visão do período</p>
              <p className="dash mt-0.5 text-base font-bold capitalize text-foreground">{selectedMonthLabel}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
              className={`${selCls} col-span-2 sm:w-auto`} aria-label="Mês do período financeiro" />
            <button onClick={() => setShowCategories(true)}
              className="dash flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-slate-600 transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary">
              <Tag className="h-3.5 w-3.5" /> Categorias
            </button>
            <button onClick={() => setShowOFX(true)}
              className="dash flex h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-slate-600 transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary">
              <Upload className="h-3.5 w-3.5" /> Importar OFX
            </button>
            <button onClick={() => { setEditing(null); setShowForm(true) }}
              className="dash col-span-2 flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-[0_6px_18px_rgba(161,79,42,0.2)] transition-all hover:-translate-y-0.5 hover:bg-[#8C4222] hover:shadow-[0_8px_22px_rgba(161,79,42,0.26)] sm:col-span-1">
              <Plus className="h-4 w-4" /> Novo lançamento
            </button>
          </div>
        </div>
      </section>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {/* Receitas */}
        <div className="dash relative min-w-0 overflow-hidden rounded-2xl border border-border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-green-500" />
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <ArrowUpRight className="w-5 h-5 text-green-600" />
            </div>
            {cmp && incomeDiff !== 0 && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold sm:text-xs" title="Comparação com o mês anterior"
                style={incomeDiff > 0
                  ? { background: 'rgba(34,197,94,0.1)', color: '#16a34a' }
                  : { background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
                {incomeDiff > 0 ? '+' : ''}{incomeDiff}%
              </span>
            )}
          </div>
          <p className="dash mb-0.5 text-xs font-semibold text-slate-500">Receitas</p>
          <p className="dash truncate text-base font-extrabold text-green-600 sm:text-xl" title={fmt(summary.totalIncome)}>
            {loading ? <span className="inline-block h-5 w-24 animate-pulse rounded bg-slate-100" /> : fmt(summary.totalIncome)}
          </p>
        </div>

        {/* Despesas */}
        <div className="dash relative min-w-0 overflow-hidden rounded-2xl border border-border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-red-500" />
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <ArrowDownRight className="w-5 h-5 text-red-500" />
            </div>
            {cmp && expenseDiff !== 0 && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold sm:text-xs" title="Comparação com o mês anterior"
                style={expenseDiff > 0
                  ? { background: 'rgba(239,68,68,0.1)', color: '#dc2626' }
                  : { background: 'rgba(34,197,94,0.1)', color: '#16a34a' }}>
                {expenseDiff > 0 ? '+' : ''}{expenseDiff}%
              </span>
            )}
          </div>
          <p className="dash mb-0.5 text-xs font-semibold text-slate-500">Despesas</p>
          <p className="dash truncate text-base font-extrabold text-red-500 sm:text-xl" title={fmt(summary.totalExpense)}>
            {loading ? <span className="inline-block h-5 w-24 animate-pulse rounded bg-slate-100" /> : fmt(summary.totalExpense)}
          </p>
        </div>

        {/* Saldo */}
        <div className="dash relative min-w-0 overflow-hidden rounded-2xl border border-border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-indigo-500" />
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={summary.balance >= 0
                ? { background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }
                : { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <TrendingUp className="w-5 h-5" style={{ color: summary.balance >= 0 ? '#4f46e5' : '#dc2626' }} />
            </div>
          </div>
          <p className="dash mb-0.5 text-xs font-semibold text-slate-500">Saldo</p>
          <p className="dash truncate text-base font-extrabold sm:text-xl" title={fmt(summary.balance)} style={{ color: summary.balance >= 0 ? '#4f46e5' : '#dc2626' }}>
            {loading ? <span className="inline-block h-5 w-24 animate-pulse rounded bg-slate-100" /> : fmt(summary.balance)}
          </p>
        </div>

        {/* A Receber */}
        <div className="dash relative min-w-0 overflow-hidden rounded-2xl border border-border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-amber-500" />
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <HandCoins className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="dash mb-0.5 text-xs font-semibold text-slate-500">A Receber</p>
          <p className="dash truncate text-base font-extrabold text-amber-600 sm:text-xl" title={fmt(stats?.receivables.total ?? 0)}>
            {!stats ? <span className="inline-block h-5 w-24 animate-pulse rounded bg-slate-100" /> : fmt(stats.receivables.total)}
          </p>
          {stats?.receivables.count ? (
            <p className="dash text-xs text-slate-400 mt-0.5">
              {stats.receivables.count} processo{stats.receivables.count !== 1 ? 's' : ''} pendente{stats.receivables.count !== 1 ? 's' : ''}
            </p>
          ) : null}
        </div>
      </div>

      {/* ── Charts + Breakdown ────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* 6-month charts */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5 lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <p className="dash text-sm font-bold text-slate-800">Histórico de 6 meses</p>
            </div>
            {stats.months.every(m => m.income === 0 && m.expense === 0) ? (
              <div className="h-40 flex flex-col items-center justify-center gap-2">
                <TrendingUp className="w-8 h-8 text-slate-200" />
                <p className="dash text-sm text-slate-400">Sem dados para este período</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />
                    <span className="dash text-xs text-slate-400 font-medium">Receitas vs Despesas</span>
                  </div>
                  <BarChartComp months={stats.months} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="w-4 h-0.5 bg-indigo-500 inline-block rounded" />
                    <span className="dash text-xs text-slate-400 font-medium">Evolução do Saldo</span>
                  </div>
                  <AreaChartComp months={stats.months} />
                </div>
              </div>
            )}
          </div>

          {/* Category breakdown */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Tag className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <p className="dash text-sm font-bold text-slate-800">Gastos por categoria</p>
            </div>
            <p className="dash text-xs text-slate-400 mb-4 ml-9">Despesas do mês selecionado</p>
            {stats.categoryBreakdown.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8">
                <Tag className="w-6 h-6 text-slate-200" />
                <p className="dash text-xs text-slate-400 text-center">Nenhuma despesa categorizada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.categoryBreakdown.map((item, i) => (
                  <div key={item.id ?? `none-${i}`}>
                    <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color ?? '#9CA3AF' }} />
                        <span className="dash truncate text-xs font-semibold text-slate-700">{item.name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="dash text-xs text-slate-400">{item.percentage}%</span>
                        <span className="dash text-xs font-bold text-red-500">{fmt(item.total)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${item.percentage}%`, background: item.color ?? '#9CA3AF' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Lançamentos e filtros ────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="dash text-sm font-bold text-foreground">Lançamentos</h2>
              {!loading && (
                <span className="dash rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{summary.count}</span>
              )}
            </div>
            <p className="dash mt-0.5 text-xs text-muted-foreground">Consulte e refine as movimentações do período.</p>
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters}
              className="dash flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5">
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Limpar filtros</span>
              <span className="sm:hidden">Limpar</span>
            </button>
          )}
        </div>

        <div className="bg-[#FBF9F7] p-3 sm:p-4">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:hidden">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
            {activeFilterCount > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] text-white">{activeFilterCount}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(220px,1fr)_auto_auto_auto]">
            <div className="relative col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/65" />
              <input value={filterQ} onChange={e => setFilterQ(e.target.value)} placeholder="Buscar por título..."
                className="dash h-10 w-full rounded-xl border border-border bg-white pl-9 pr-9 text-sm text-slate-700 outline-none transition-all placeholder:text-muted-foreground/55 focus:border-primary focus:ring-4 focus:ring-primary/10" />
              {filterQ && (
                <button onClick={() => setFilterQ('')} aria-label="Limpar busca"
                  className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-muted hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className={selCls} aria-label="Filtrar por tipo">
              <option value="">Todos os tipos</option>
              <option value="INCOME">Entradas</option>
              <option value="EXPENSE">Saídas</option>
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={selCls} aria-label="Filtrar por categoria">
              <option value="">Categorias</option>
              <option value="none">Sem categoria</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`${selCls} col-span-2 lg:col-span-1`} aria-label="Filtrar por status">
              <option value="">Todos os status</option>
              <option value="CONFIRMED">Confirmados</option>
              <option value="PREDICTED">Previstos</option>
              <option value="OVERDUE">Em atraso</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── Entry list grouped by day ─────────────────────────────────────── */}
      {loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center">
          <AlertCircle className="mx-auto h-7 w-7 text-red-400" />
          <p className="dash mt-2 text-sm font-bold text-red-700">Não foi possível carregar o financeiro</p>
          <p className="dash mx-auto mt-1 max-w-lg text-xs text-red-600/80">{loadError}</p>
          <button onClick={loadEntries}
            className="dash mx-auto mt-4 flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 text-xs font-bold text-red-700 transition-colors hover:bg-red-100">
            <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8">
              <Wallet className="h-7 w-7 text-primary/50" />
            </div>
            <p className="dash text-base font-bold text-slate-700 mb-1">
              {activeFilterCount > 0
                ? 'Nenhum resultado para os filtros aplicados'
                : 'Nenhum lançamento neste período'}
            </p>
            <p className="dash text-sm text-slate-400 mb-5">
              {activeFilterCount > 0
                ? 'Tente remover alguns filtros.'
                : 'Registre o primeiro lançamento do mês.'}
            </p>
            {activeFilterCount > 0 ? (
              <button onClick={clearFilters}
                className="dash flex items-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/5">
                <RotateCcw className="h-4 w-4" /> Limpar filtros
              </button>
            ) : (
              <button onClick={() => { setEditing(null); setShowForm(true) }}
                className="dash rounded-xl border-2 border-dashed border-primary/30 px-5 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/5 cursor-pointer">
                + Registrar lançamento
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => {
            const dayIn  = group.entries.filter(e => e.type === 'INCOME').reduce((s, e) => s + e.amount, 0)
            const dayOut = group.entries.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + e.amount, 0)
            return (
              <div key={group.key}>
                {/* Day header */}
                <div className="mb-2 flex flex-col gap-1.5 border-b border-slate-100 px-1 py-1.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="dash text-xs font-bold uppercase tracking-widest text-slate-400">{group.label}</span>
                  <div className="flex gap-3">
                    {dayIn  > 0 && <span className="dash text-xs font-bold text-green-600">+{fmt(dayIn)}</span>}
                    {dayOut > 0 && <span className="dash text-xs font-bold text-red-500">-{fmt(dayOut)}</span>}
                  </div>
                </div>

                {/* Entry rows */}
                <div className="space-y-2">
                  {group.entries.map(entry => {
                    const isIn  = entry.type === 'INCOME'
                    const stCfg = STATUS_CFG[entry.status]
                    return (
                      <article key={entry.id} onClick={() => setShowDetail(entry)}
                        className={`dash cursor-pointer rounded-2xl border bg-white p-3.5 shadow-sm transition-all hover:-translate-y-px hover:shadow-md sm:p-4 ${entry.status === 'OVERDUE' ? 'border-red-200' : 'border-border'}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                            style={isIn
                              ? { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }
                              : { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            {isIn
                              ? <ArrowUpRight className="h-4 w-4 text-green-600" />
                              : <ArrowDownRight className="h-4 w-4 text-red-500" />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="dash truncate text-sm font-bold text-slate-800">{entry.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {entry.status !== 'CONFIRMED' && (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${stCfg.cls}`}>
                                  <stCfg.Icon className="h-2.5 w-2.5" /> {stCfg.label}
                                </span>
                              )}
                              {entry.recurrence !== 'NONE' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                                  <RefreshCw className="h-2.5 w-2.5" /> {RECURRENCE_LABELS[entry.recurrence]}
                                </span>
                              )}
                              {entry.category && (
                                <span className="dash flex min-w-0 items-center gap-1 text-xs text-slate-400">
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: entry.category.color }} />
                                  <span className="truncate">{entry.category.name}</span>
                                </span>
                              )}
                            </div>
                            {entry.description && <p className="dash mt-1 truncate text-xs text-slate-300">{entry.description}</p>}
                          </div>

                          <div className="hidden shrink-0 items-center gap-3 sm:flex">
                            <span className={`dash text-base font-extrabold ${isIn ? 'text-green-600' : 'text-red-500'}`}>
                              {isIn ? '+' : '-'}{fmt(entry.amount)}
                            </span>
                            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                              <button onClick={() => openEdit(entry)} aria-label={`Editar ${entry.title}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-600">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => remove(entry.id)} aria-label={`Excluir ${entry.title}`}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="ml-12 mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 sm:hidden">
                          <span className={`dash text-base font-extrabold ${isIn ? 'text-green-600' : 'text-red-500'}`}>
                            {isIn ? '+' : '-'}{fmt(entry.amount)}
                          </span>
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <button onClick={() => openEdit(entry)} aria-label={`Editar ${entry.title}`}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => remove(entry.id)} aria-label={`Excluir ${entry.title}`}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
