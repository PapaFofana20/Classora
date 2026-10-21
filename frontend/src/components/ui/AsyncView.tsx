import type { ReactNode } from "react";
import type { AsyncState } from "@/hooks/useAsync";
import { SkeletonCards, SkeletonTable } from "./Skeleton";
import { ErrorState } from "./EmptyState";

interface Props<T> {
  state: AsyncState<T>;
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
}

/** Gère les états chargement (skeleton) / erreur (réessai) / contenu. */
export function AsyncView<T>({ state, children, skeleton }: Props<T>) {
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (state.loading && state.data === null)
    return (
      <>
        {skeleton ?? (
          <div className="space-y-4">
            <SkeletonCards />
            <SkeletonTable />
          </div>
        )}
      </>
    );
  if (state.data === null) return null;
  return <>{children(state.data)}</>;
}
