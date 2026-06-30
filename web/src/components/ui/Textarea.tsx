import type { TextareaHTMLAttributes } from 'react'
import { Label } from './Label'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  id: string
  error?: string
}

export function Textarea({ label, id, error, className = '', required, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <textarea
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={[
          'block w-full rounded-md border px-3 py-2 text-sm',
          'placeholder:text-neutral-400',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          'disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500',
          'transition-colors resize-y min-h-[6rem]',
          error
            ? 'border-error-500 focus:border-error-500 focus:ring-error-500'
            : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-500',
          className,
        ].join(' ')}
        required={required}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-error-600">
          {error}
        </p>
      )}
    </div>
  )
}
