import type { SelectHTMLAttributes } from 'react'
import { Label } from './Label'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  id: string
  options: SelectOption[]
  error?: string
}

export function Select({ label, id, options, error, className = '', required, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <select
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={[
          'block w-full rounded-md border px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          'disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500',
          'transition-colors bg-white',
          error
            ? 'border-error-500 focus:border-error-500 focus:ring-error-500'
            : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-500',
          className,
        ].join(' ')}
        required={required}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-error-600">
          {error}
        </p>
      )}
    </div>
  )
}
