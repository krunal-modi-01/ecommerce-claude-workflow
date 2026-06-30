import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white p-6 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
