import type { ReactNode } from 'react'

interface AlertProps {
  variant: 'error' | 'success' | 'info'
  children: ReactNode
  className?: string
}

const styles: Record<AlertProps['variant'], string> = {
  error: 'bg-error-50 border-error-200 text-error-700',
  success: 'bg-success-50 border-success-200 text-success-700',
  info: 'bg-primary-50 border-primary-200 text-primary-700',
}

export function Alert({ variant, children, className = '' }: AlertProps) {
  return (
    <div
      role="alert"
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`rounded-md border px-4 py-3 text-sm ${styles[variant]} ${className}`}
    >
      {children}
    </div>
  )
}
