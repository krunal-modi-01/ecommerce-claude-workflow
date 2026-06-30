import { Card } from './Card'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded bg-neutral-200 ${className}`} aria-hidden="true" />
}

export function SkeletonCard() {
  return (
    <Card className="flex flex-col gap-3 p-0 overflow-hidden">
      <Skeleton className="h-48 w-full rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-4 w-1/3 mt-1" />
      </div>
    </Card>
  )
}
