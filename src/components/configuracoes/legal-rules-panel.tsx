import { ExternalLink, Scale } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { LegalRuleVersion } from '@/types/database'

export function LegalRulesPanel({ rules }: { rules: LegalRuleVersion[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50">
          <Scale className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <h2 className="dash text-sm font-bold text-slate-900">Regras jurídicas versionadas</h2>
          <p className="dash mt-0.5 text-xs text-slate-400">Fontes e vigências usadas pelo assistente operacional</p>
        </div>
        <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{rules.length}</span>
      </div>
      {rules.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-400">Aplique a migration de workflow para carregar as regras oficiais.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {rules.map(rule => (
            <div key={rule.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{rule.title}</p>
                <p className="mt-1 text-xs text-slate-500">{rule.version} · vigente desde {formatDate(rule.effective_from)}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${rule.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {rule.is_active ? 'Ativa' : 'Inativa'}
              </span>
              <a href={rule.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                Fonte <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

