'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { maskCPF, maskRG, maskPhone } from '@/lib/masks'

type MaskType = 'cpf' | 'rg' | 'phone'

const MASKS: Record<MaskType, (v: string) => string> = {
  cpf: maskCPF,
  rg: maskRG,
  phone: maskPhone,
}

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  mask: MaskType
  label?: string
  error?: string
  helperText?: string
  value: string
  onChange: (value: string) => void
}

export function MaskedInput({
  mask, label, error, helperText, value, onChange, className, id, ...props
}: MaskedInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  const applyMask = MASKS[mask]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const masked = applyMask(raw)

    // Preserve cursor position after masking
    const el = inputRef.current
    if (el) {
      const cursorBefore = e.target.selectionStart ?? masked.length
      const digitsBefore = raw.slice(0, cursorBefore).replace(/\D/g, '').length
      onChange(masked)

      // Recalculate cursor after state update
      requestAnimationFrame(() => {
        if (!inputRef.current) return
        let digitsSeen = 0
        let newCursor = masked.length
        for (let i = 0; i < masked.length; i++) {
          if (/\d/.test(masked[i])) digitsSeen++
          if (digitsSeen === digitsBefore) { newCursor = i + 1; break }
        }
        inputRef.current.setSelectionRange(newCursor, newCursor)
      })
    } else {
      onChange(masked)
    }
  }

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        id={inputId}
        value={value}
        onChange={handleChange}
        inputMode="numeric"
        autoComplete="off"
        className={cn(
          'block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm',
          'placeholder:text-slate-400',
          'focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring',
          'disabled:bg-slate-50 disabled:cursor-not-allowed',
          error && 'border-red-400 focus:border-red-400 focus:ring-red-400',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {helperText && !error && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  )
}
