'use client'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const variantClasses = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-ring',
  outline: 'border border-border bg-card text-foreground hover:bg-muted focus:ring-ring',
  ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground focus:ring-ring',
  danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
}

export function Button({
  variant = 'primary', size = 'md', loading, disabled, children, className, ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}
