import { cn } from "@/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton rounded-xl", className)} />;
}

export function SkeletonCards({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)} role="status" aria-label="Chargement en cours">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl bg-white p-5 shadow-card">
          <Skeleton className="mb-4 size-10 rounded-full" />
          <Skeleton className="mb-2 h-4 w-1/2" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card" role="status" aria-label="Chargement du tableau">
      <Skeleton className="mb-5 h-6 w-48" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="mb-3 h-10 w-full" />
      ))}
    </div>
  );
}
