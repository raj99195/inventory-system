import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse bg-gradient-to-r from-brand-cream-dark via-brand-cream-deep to-brand-cream-dark bg-[length:200%_100%] rounded-2xl',
        className
      )}
      style={{ animation: 'shimmer 2s infinite linear' }}
    />
  );
}

export function ProductRowSkeleton() {
  return (
    <div className="card flex items-center gap-4">
      <Skeleton className="w-16 h-16 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-8 w-8" />
    </div>
  );
}
