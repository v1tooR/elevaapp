'use client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface ChartItem {
  label: string
  count: number
  color: string
}

interface Props {
  data: ChartItem[]
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div
      className="rounded-xl px-3 py-2 shadow-lg border border-slate-100"
      style={{ background: '#fff', minWidth: 100 }}
    >
      <p className="dash text-[11px] text-slate-500 mb-0.5">{d.payload.label}</p>
      <p className="dash text-sm font-bold" style={{ color: d.fill }}>{d.value}</p>
    </div>
  )
}

export function ProcessesStatusChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-full text-slate-300 text-sm dash">
        Sem dados
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={88}
          tick={{ fontSize: 11, fontFamily: 'Outfit, sans-serif', fill: '#94A3B8' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={18}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
