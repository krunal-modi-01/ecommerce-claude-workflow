import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Spinner } from './Spinner'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
}

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500 border border-transparent',
  secondary:
    'bg-white text-primary-600 hover:bg-primary-50 focus-visible:ring-primary-500 border border-primary-600',
  ghost:
    'bg-transparent text-primary-600 hover:bg-primary-50 focus-visible:ring-primary-500 border border-transparent',
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading
  return (
    <button
      disabled={isDisabled}
      aria-busy={loading}
      className={[
        btnBase,
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        className,
      ].join(' ')}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}

interface LinkButtonProps extends Omit<LinkProps, 'className'> {
  variant?: ButtonVariant
  className?: string
}

export function LinkButton({ variant = 'primary', className = '', children, ...props }: LinkButtonProps) {
  return (
    <Link
      className={[btnBase, variantClasses[variant], className].join(' ')}
      {...props}
    >
      {children}
    </Link>
  )
}
