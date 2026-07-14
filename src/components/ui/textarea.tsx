import { cn } from '@/lib/utils'
import type { TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={3}
        className={cn(
          'block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground resize-none',
          'placeholder:text-muted-foreground',
          'focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring',
          'disabled:bg-muted disabled:cursor-not-allowed',
          error && 'border-destructive',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
