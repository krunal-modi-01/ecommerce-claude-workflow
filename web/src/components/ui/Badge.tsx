interface BadgeProps {
  label: string
  variant?: 'success' | 'neutral' | 'info'
  className?: string
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  success: 'bg-success-50 text-success-700 ring-success-200',
  neutral: 'bg-neutral-100 text-neutral-600 ring-neutral-200',
  info: 'bg-primary-50 text-primary-700 ring-primary-200',
}

export function Badge({ label, variant = 'neutral', className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {label}
    </span>
  )
}
